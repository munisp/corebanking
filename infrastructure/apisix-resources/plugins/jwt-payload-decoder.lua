--- 54link APISIX JWT Payload Decoder Plugin

local core = require("apisix.core")
local ngx = ngx

local plugin_name = "54link-jwt-payload-decoder"

local schema = {
    type = "object",
    properties = {
        token_query_name = {
            type = "string",
            default = "token",
            description = "Query parameter used to locate the JWT",
        },
        token_cookie_name = {
            type = "string",
            default = "access_token",
            description = "Cookie used to locate the JWT",
        },
    },
}

local _M = {
    version = 0.1,
    priority = 2508,
    name = plugin_name,
    schema = schema,
}

local function base64url_decode(value)
    if not value then
        return nil
    end

    local normalized = value:gsub("-", "+"):gsub("_", "/")
    local remainder = #normalized % 4

    if remainder == 2 then
        normalized = normalized .. "=="
    elseif remainder == 3 then
        normalized = normalized .. "="
    elseif remainder == 1 then
        return nil
    end

    return ngx.decode_base64(normalized)
end

local function get_cookie(ctx, cookie_name)
    local cookie_header = ctx.var.http_cookie
    if not cookie_header then
        return nil
    end

    for cookie in string.gmatch(cookie_header, "[^;]+") do
        local key, value = string.match(cookie, "%s*(.-)%s*=%s*(.*)")
        if key == cookie_name then
            return value
        end
    end

    return nil
end

local function get_token(conf, ctx)
    local token = core.request.get_uri_args(ctx)[conf.token_query_name or "token"]
    if token then
        return token
    end

    token = get_cookie(ctx, conf.token_cookie_name or "access_token")
    if token then
        return token
    end

    local auth_header = core.request.header(ctx, "Authorization")
    if auth_header and auth_header:match("^Bearer%s+(%S+)$") then
        return auth_header:match("^Bearer%s+(%S+)$")
    end

    return nil
end

local function decode_claims(token)
    local parts = {}
    for part in string.gmatch(token, "[^.]+") do
        parts[#parts + 1] = part
    end

    if #parts ~= 3 then
        return nil, "invalid JWT format"
    end

    local payload = base64url_decode(parts[2])
    if not payload then
        return nil, "unable to decode JWT payload"
    end

    local claims = core.json.decode(payload)
    if not claims then
        return nil, "unable to parse JWT payload"
    end

    return claims
end

local function pick_first(claims, keys)
    for _, key in ipairs(keys) do
        local value = claims[key]
        if value and value ~= "" then
            return value
        end
    end
    return nil
end

local function extract_roles(claims)
    local roles = {}

    local platform_role = pick_first(claims, {"platform_role", "platformRole", "role", "user_role"})
    if type(platform_role) == "string" and platform_role ~= "" then
        return platform_role
    end

    if type(claims.roles) == "table" and #claims.roles > 0 then
        return tostring(claims.roles[1])
    end

    local realm_access = claims.realm_access
    if type(realm_access) == "table" and type(realm_access.roles) == "table" and #realm_access.roles > 0 then
        return tostring(realm_access.roles[1])
    end

    local resource_access = claims.resource_access
    if type(resource_access) == "table" then
        for _, app in pairs(resource_access) do
            if type(app) == "table" and type(app.roles) == "table" and #app.roles > 0 then
                return tostring(app.roles[1])
            end
        end
    end

    return nil
end

function _M.access(conf, ctx)
    if ctx.var.request_method == "OPTIONS" then
        return
    end

    local token = get_token(conf, ctx)
    if not token then
        return 401, { message = "Missing JWT token" }
    end

    local claims, err = decode_claims(token)
    if not claims then
        return 401, { message = err }
    end

    local keycloak_id = pick_first(claims, {"sub", "id", "keycloak_id", "user_id"})
    if keycloak_id then
        core.request.set_header(ctx, "x-keycloak-id", tostring(keycloak_id))
        core.request.set_header(ctx, "x-user-id", tostring(keycloak_id))
    end

    local tenant_id = pick_first(claims, {"tenant_id", "tenantId"})
    if tenant_id then
        core.request.set_header(ctx, "x-tenant-id", tostring(tenant_id))
    end

    local tenant_name = pick_first(claims, {"tenant_name", "tenantName", "tenant"})
    if tenant_name then
        core.request.set_header(ctx, "x-tenant-name", tostring(tenant_name))
    end

    local user_role = extract_roles(claims)
    if user_role then
        core.request.set_header(ctx, "x-user-role", tostring(user_role))
    end

    local email = pick_first(claims, {"email", "preferred_username"})
    if email then
        core.request.set_header(ctx, "x-user-email", tostring(email))
    end
end

function _M.check_schema(conf, schema_type)
    return core.schema.check(schema, conf)
end

return _M