package com.lyle.apiperformance.service;

import com.sun.net.httpserver.HttpServer;
import com.lyle.apiperformance.controller.PerformanceController;
import com.lyle.apiperformance.controller.PerformanceExceptionHandler;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class PerformanceServiceIntegrationTest {
    private static final String APPROVED = "https://jsonplaceholder.typicode.com/posts";
    private HttpServer server;
    private ExecutorService serverExecutor;
    private HttpRequestExecutor transport;
    private PerformanceService service;
    private final AtomicInteger active = new AtomicInteger();
    private final AtomicInteger peak = new AtomicInteger();
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicBoolean virtualThreads = new AtomicBoolean(true);
    private final AtomicBoolean barrierCompleted = new AtomicBoolean(true);
    private CountDownLatch firstWave = new CountDownLatch(1);

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serverExecutor = Executors.newVirtualThreadPerTaskExecutor();
        server.setExecutor(serverExecutor);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            peak.accumulateAndGet(active.incrementAndGet(), Math::max);
            try {
                firstWave.countDown();
                if (!firstWave.await(5, TimeUnit.SECONDS)) {
                    barrierCompleted.set(false);
                }
                Thread.sleep(30);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                active.decrementAndGet();
            }
            exchange.sendResponseHeaders(status.get(), -1);
            exchange.close();
        });
        server.start();
        String localUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
        // Rewrite only inside the test transport; the service still validates APPROVED.
        transport = new HttpRequestExecutor() {
            @Override
            public int execute(String url) throws IOException, InterruptedException {
                virtualThreads.compareAndSet(true, Thread.currentThread().isVirtual());
                return super.execute(localUrl);
            }
        };
        service = new PerformanceService(new PercentileCalculator(), transport);
    }

    @AfterEach
    void tearDown() {
        transport.close();
        server.stop(0);
        serverExecutor.close();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 10})
    void concurrentRequestsOverlapAndRespectLimit(int limit) throws Exception {
        firstWave = new CountDownLatch(limit);
        var result = service.analyzeConcurrently(APPROVED, 20, limit);
        assertTrue(barrierCompleted.get(), "The first wave must overlap at the server");
        assertEquals(limit, peak.get());
        assertEquals(20, calls.get());
        assertTrue(virtualThreads.get(), "HTTP work must run on virtual threads");
        assertEquals(100.0, result.successRate());
        assertTrue(result.totalExecutionTimeMs() > 0);
        double inferredMillis = 20_000.0 / result.throughputRequestsPerSecond();
        assertTrue(inferredMillis >= result.totalExecutionTimeMs());
        assertTrue(inferredMillis < result.totalExecutionTimeMs() + 1.0);
        assertTrue(result.minResponseTimeMs() <= result.p50ResponseTimeMs());
        assertTrue(result.p50ResponseTimeMs() <= result.p95ResponseTimeMs());
        assertTrue(result.p95ResponseTimeMs() <= result.p99ResponseTimeMs());
        assertTrue(result.p99ResponseTimeMs() <= result.maxResponseTimeMs());
    }

    @Test
    void sequentialRequestsAndSingleRequestUseRealTransport() throws Exception {
        var single = service.measureResponseTime(APPROVED);
        assertEquals(200, single.statusCode());
        assertTrue(single.success());
        assertTrue(single.responseTimeMs() >= 30);
        var summary = service.analyzePerformance(APPROVED, 4);
        assertEquals(4, summary.totalRequests());
        assertEquals(100.0, summary.successRate());
        assertEquals(1, peak.get());
        assertEquals(5, calls.get());
    }

    @Test
    void nonSuccessfulHttpStatusIsPreservedAndCounted() throws Exception {
        status.set(503);
        var result = service.measureResponseTime(APPROVED);
        assertEquals(503, result.statusCode());
        assertFalse(result.success());
        assertEquals(0.0, service.analyzePerformance(APPROVED, 2).successRate());
        assertEquals(0.0, service.analyzeConcurrently(APPROVED, 4, 2).successRate());
    }

    @Test
    void connectionFailuresProduceResultsAndDoNotAbortBatches() throws Exception {
        server.stop(0);
        var result = service.measureResponseTime(APPROVED);
        assertEquals(0, result.statusCode());
        assertFalse(result.success());
        assertEquals(0.0, service.analyzePerformance(APPROVED, 3).successRate());
        assertEquals(0.0, service.analyzeConcurrently(APPROVED, 5, 2).successRate());
    }

    @Test
    void allEntryPointsRejectLocalAndNullUrlsBeforeTransport() {
        for (String url : new String[]{"http://127.0.0.1", null, APPROVED + "/"}) {
            assertThrows(IllegalArgumentException.class, () -> service.measureResponseTime(url));
            assertThrows(IllegalArgumentException.class, () -> service.analyzePerformance(url, 2));
            assertThrows(IllegalArgumentException.class, () -> service.analyzeConcurrently(url, 2, 2));
        }
        assertEquals(0, calls.get());
    }

    @Test
    void sequentialRequestBoundsAreValidatedBeforeTransport() {
        for (int count : new int[]{-1, 0, 101}) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.analyzePerformance(APPROVED, count));
        }
        assertEquals(0, calls.get());
    }

    @Test
    void restEndpointsKeepResponseFieldsAndReturnBadRequestForInvalidInput() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new PerformanceController(service))
                .setControllerAdvice(new PerformanceExceptionHandler()).build();
        mvc.perform(get("/api/performance/test").param("url", APPROVED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(APPROVED))
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.responseTimeMs").isNumber())
                .andExpect(jsonPath("$.success").value(true));
        for (String endpoint : new String[]{"analyze", "concurrent"}) {
            var response = mvc.perform(get("/api/performance/" + endpoint)
                    .param("url", APPROVED).param("requestCount", "3")
                    .param("concurrencyLevel", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.url").value(APPROVED))
                    .andExpect(jsonPath("$.totalRequests").value(3))
                    .andExpect(jsonPath("$.successRate").value(100.0));
            for (String field : new String[]{"averageResponseTimeMs", "minResponseTimeMs",
                    "maxResponseTimeMs", "p50ResponseTimeMs", "p95ResponseTimeMs", "p99ResponseTimeMs"}) {
                response.andExpect(jsonPath("$." + field).isNumber());
            }
            if (endpoint.equals("concurrent")) {
                response.andExpect(jsonPath("$.concurrencyLevel").value(2))
                        .andExpect(jsonPath("$.totalExecutionTimeMs").isNumber())
                        .andExpect(jsonPath("$.throughputRequestsPerSecond").isNumber());
            }
        }
        mvc.perform(get("/api/performance/test").param("url", "http://localhost"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Only the approved test endpoint is allowed"));
        mvc.perform(get("/api/performance/concurrent").param("url", APPROVED)
                .param("requestCount", "101").param("concurrencyLevel", "2"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void redirectsAreNotFollowed() throws Exception {
        server.removeContext("/");
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            exchange.getResponseHeaders().add("Location", "/redirected");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        assertEquals(302, service.measureResponseTime(APPROVED).statusCode());
        assertEquals(1, calls.get());
    }
}
