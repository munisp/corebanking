module github.com/54link-dev/middleware-go

go 1.22

require github.com/lib/pq v1.10.9 // indirect

require github.com/munisp/corebanking/pkg/tbclient v0.0.0

require github.com/tigerbeetle/tigerbeetle-go v0.17.0 // indirect

replace github.com/munisp/corebanking/pkg/tbclient => ../../pkg/tbclient
