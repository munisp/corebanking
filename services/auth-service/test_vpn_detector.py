"""
VPN Detector — real unit tests.

H-40 remediation: the previous version of this file printed detection results
for a handful of IPs and asserted nothing; its "PASS/FAIL" output for
`_is_datacenter_ip` was computed but never turned into a test result, and the
`detect()` cases depended on live reverse-DNS lookups.

These tests drive the real ``utils.vpn_detector.VPNDetector`` with the DNS
layer stubbed deterministically and assert:

- private/loopback/link-local IPs bypass detection entirely
- known datacenter CIDRs (AWS/GCP/Azure/DigitalOcean) are flagged
- hostname patterns classify Tor (critical) and VPN (high, implies proxy)
- clean public IPs with no rDNS are classified low-risk
- detection never throws on garbage input
"""

import socket

from utils.vpn_detector import VPNDetector, detect_vpn


def _stub_dns(monkey_hostname=None):
    """Return a _get_hostname replacement: fixed hostname, or no rDNS record."""
    original = VPNDetector._get_hostname

    def fake(ip):
        if monkey_hostname is not None:
            return monkey_hostname
        return None

    VPNDetector._get_hostname = staticmethod(fake)
    return original


def _restore(original):
    VPNDetector._get_hostname = original


# --- _is_private_ip ---------------------------------------------------------

def test_private_ips_detected():
    for ip in ["127.0.0.1", "10.0.0.1", "10.255.255.255", "172.16.0.1",
               "172.31.255.255", "192.168.1.1", "169.254.0.1"]:
        assert VPNDetector._is_private_ip(ip) is True, f"{ip} must be private"


def test_public_ips_not_private():
    for ip in ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.167.1.1"]:
        assert VPNDetector._is_private_ip(ip) is False, f"{ip} must be public"


def test_malformed_ip_not_private_and_not_datacenter():
    assert VPNDetector._is_private_ip("not-an-ip") is False
    # Octets parse as ints; 999 is outside every private range → public.
    assert VPNDetector._is_private_ip("999.1.1.1") is False
    assert VPNDetector._is_datacenter_ip("not-an-ip") is False


# --- _is_datacenter_ip ------------------------------------------------------

def test_datacenter_ranges_match():
    # Ranges straight from VPNDetector.DATACENTER_IP_RANGES.
    cases = {
        "52.1.1.1": True,        # AWS 52.0.0.0/8
        "54.200.1.1": True,      # AWS 54.0.0.0/8
        "35.184.1.1": True,      # GCP 35.184.0.0/13
        "13.64.1.1": True,       # Azure 13.64.0.0/11
        "104.131.1.1": True,     # DigitalOcean 104.131.0.0/16
        "45.79.1.1": True,       # Linode 45.79.0.0/16
        "8.8.8.8": False,        # Google DNS — NOT in the datacenter list
        "1.1.1.1": False,        # Cloudflare DNS — NOT in the datacenter list
        "105.0.0.1": False,
    }
    for ip, expected in cases.items():
        got = VPNDetector._is_datacenter_ip(ip)
        assert got is expected, f"_is_datacenter_ip({ip}) = {got}, want {expected}"


# --- detect() end-to-end with deterministic DNS ------------------------------

def test_detect_private_ip_short_circuits():
    result = detect_vpn("192.168.1.1")
    assert result == {
        "is_vpn": False,
        "is_tor": False,
        "is_proxy": False,
        "is_datacenter": False,
        "threat_level": "low",
        "detection_method": None,
    }, "private IPs must bypass all detection"


def test_detect_tor_exit_hostname_is_critical():
    orig = _stub_dns("tor-exit-node-7.example.org")
    try:
        result = detect_vpn("203.0.113.9")
        assert result["is_tor"] is True
        assert result["threat_level"] == "critical"
        assert result["detection_method"] == "reverse_dns_tor"
    finally:
        _restore(orig)


def test_detect_vpn_hostname_is_high_and_implies_proxy():
    orig = _stub_dns("node-42.nordvpn.net")
    try:
        result = detect_vpn("203.0.113.10")
        assert result["is_vpn"] is True
        assert result["is_proxy"] is True, "VPN classification must also mark proxy"
        assert result["threat_level"] == "high"
        assert result["detection_method"] == "reverse_dns_vpn"
    finally:
        _restore(orig)


def test_detect_datacenter_by_hostname():
    orig = _stub_dns("ec2-52-1-2-3.compute-1.amazonaws.com")
    try:
        result = detect_vpn("203.0.113.11")
        assert result["is_datacenter"] is True
        assert result["threat_level"] == "high"
        assert result["detection_method"] == "reverse_dns_datacenter"
    finally:
        _restore(orig)


def test_detect_datacenter_by_ip_range_without_hostname():
    orig = _stub_dns(None)  # no rDNS
    try:
        result = detect_vpn("52.1.1.1")
        assert result["is_datacenter"] is True
        assert result["detection_method"] == "ip_range_datacenter"
    finally:
        _restore(orig)


def test_detect_clean_public_ip_is_low_risk():
    orig = _stub_dns(None)
    try:
        result = detect_vpn("8.8.8.8")
        assert result["is_vpn"] is False
        assert result["is_tor"] is False
        assert result["is_proxy"] is False
        assert result["is_datacenter"] is False
        assert result["threat_level"] == "low"
    finally:
        _restore(orig)


def test_detect_never_raises_on_dns_errors():
    orig = VPNDetector._get_hostname

    def boom(ip):
        raise socket.gaierror("DNS down")

    VPNDetector._get_hostname = staticmethod(boom)
    try:
        result = detect_vpn("8.8.8.8")  # must fall through to IP-range check
        assert result["threat_level"] == "low"
        assert result["is_datacenter"] is False
    finally:
        VPNDetector._get_hostname = orig


def test_get_hostname_swallows_dns_failures():
    # A guaranteed-unresolvable address must yield None, not an exception.
    assert VPNDetector._get_hostname("0.0.0.0") is None


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
