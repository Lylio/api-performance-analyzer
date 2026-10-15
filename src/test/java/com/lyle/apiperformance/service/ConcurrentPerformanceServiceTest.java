
package com.lyle.apiperformance.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class ConcurrentPerformanceServiceTest {

    private PerformanceService performanceService;
    private HttpRequestExecutor transport;

    @BeforeEach
    void setUp() {
        transport = new HttpRequestExecutor();
        performanceService = new PerformanceService(
                new PercentileCalculator(), transport
        );
    }

    @AfterEach
    void tearDown() {
        transport.close();
    }

    @Test
    void shouldRejectZeroRequests() {
        assertThrows(
                IllegalArgumentException.class,
                () -> performanceService.analyzeConcurrently(
                        "https://jsonplaceholder.typicode.com/posts",
                        0,
                        3
                )
        );
    }

    @Test
    void shouldRejectExcessiveRequests() {
        assertThrows(
                IllegalArgumentException.class,
                () -> performanceService.analyzeConcurrently(
                        "https://jsonplaceholder.typicode.com/posts",
                        101,
                        3
                )
        );
    }

    @Test
    void shouldRejectZeroConcurrency() {
        assertThrows(
                IllegalArgumentException.class,
                () -> performanceService.analyzeConcurrently(
                        "https://jsonplaceholder.typicode.com/posts",
                        10,
                        0
                )
        );
    }

    @Test
    void shouldRejectExcessiveConcurrency() {
        assertThrows(
                IllegalArgumentException.class,
                () -> performanceService.analyzeConcurrently(
                        "https://jsonplaceholder.typicode.com/posts",
                        10,
                        11
                )
        );
    }

    @Test
    void shouldRejectUnapprovedUrl() {
        assertThrows(
                IllegalArgumentException.class,
                () -> performanceService.analyzeConcurrently(
                        "https://example.com",
                        10,
                        3
                )
        );
    }
}
