package com.lyle.apiperformance.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TargetValidatorTest {
    private final TargetValidator validator = new TargetValidator(List.of(
            "https://jsonplaceholder.typicode.com/posts", "http://localhost:8081/actuator/health?ready=true"));

    @Test
    void normalizesSchemeHostDefaultPortAndDotSegments() {
        assertEquals("https://jsonplaceholder.typicode.com/posts",
                validator.validate("HTTPS://JSONPLACEHOLDER.typicode.com:443/a/../posts"));
        assertEquals(2, validator.approvedTargets().size());
        assertEquals("http://localhost:8081/actuator/health?ready=true",
                validator.validate("http://LOCALHOST:8081/actuator/health?ready=true"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"http://localhost:8082/actuator/health?ready=true",
            "https://localhost:8081/actuator/health?ready=true",
            "http://localhost:8081/actuator/env?ready=true",
            "http://localhost:8081/actuator/health", "http://localhost:8081/actuator/health?ready=false",
            "http://localhost:8081/actuator/health?ready=true&x=1",
            "https://jsonplaceholder.typicode.com/posts/", "http://169.254.169.254/latest/meta-data",
            "http://127.0.0.1:8081/actuator/health?ready=true", "file:///etc/passwd",
            "https://user:pass@jsonplaceholder.typicode.com/posts",
            "https://jsonplaceholder.typicode.com/posts#fragment", "http://[broken", "not a url",
            "http://localhost:99999/", "http://localhost:0/", "http://localhost:/"})
    void rejectsAnythingOtherThanExactApprovedTargets(String url) {
        assertThrows(IllegalArgumentException.class, () -> validator.validate(url));
    }

    @Test
    void rejectsInvalidConfiguration() {
        assertThrows(IllegalArgumentException.class, () -> new TargetValidator(List.of("http://user@localhost/")));
        assertThrows(IllegalArgumentException.class, () -> new TargetValidator(List.of()));
    }

    @Test
    void privateDnsAnswersAreRejectedButExplicitIpAndLocalhostWork() throws Exception {
        for (String ip : List.of("127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1",
                "169.254.169.254", "100.64.0.1", "::1", "fc00::1", "fe80::1")) {
            var addresses = new InetAddress[]{InetAddress.getByName(ip)};
            assertThrows(UnknownHostException.class,
                    () -> PinnedDnsResolver.checkAddresses("rebinding.example", false, addresses));
            PinnedDnsResolver.checkAddresses(ip, true, addresses);
        }
        var resolver = new PinnedDnsResolver();
        var addresses = resolver.resolve("localhost");
        assertTrue(addresses[0].isLoopbackAddress());
        addresses[0] = InetAddress.getByName("192.168.1.1");
        assertTrue(resolver.resolve("localhost")[0].isLoopbackAddress());
    }
}
