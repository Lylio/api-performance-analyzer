package com.lyle.apiperformance.service;

import org.apache.hc.client5.http.DnsResolver;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Pins each host for the lifetime of the transport, including across pool reconnects. */
final class PinnedDnsResolver implements DnsResolver {
    private final Map<String, InetAddress[]> pinned = new ConcurrentHashMap<>();

    @Override
    public synchronized InetAddress[] resolve(String host) throws UnknownHostException {
        if (!pinned.containsKey(host)) {
            InetAddress[] addresses = host.equalsIgnoreCase("localhost")
                    ? new InetAddress[]{InetAddress.getByAddress(new byte[]{127, 0, 0, 1})}
                    : InetAddress.getAllByName(host);
            // Private IP literals are intentional operator approvals; DNS names must stay public.
            boolean literal = host.contains(":") || host.matches("[0-9.]+");
            checkAddresses(host, literal, addresses);
            pinned.put(host, addresses.clone());
        }
        return pinned.get(host).clone();
    }

    static void checkAddresses(String host, boolean literal, InetAddress[] addresses) throws UnknownHostException {
        if (literal || host.equalsIgnoreCase("localhost")) return;
        for (InetAddress address : addresses) {
            byte[] bytes = address.getAddress();
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress() || address.isMulticastAddress()
                    || (bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc)
                    || (bytes.length == 4 && (bytes[0] & 255) == 100 && (bytes[1] & 0xc0) == 64)) {
                throw new UnknownHostException("DNS target resolves to a non-public address; approve an exact IP URL instead");
            }
        }
    }

    @Override
    public String resolveCanonicalHostname(String host) {
        return host;
    }
}
