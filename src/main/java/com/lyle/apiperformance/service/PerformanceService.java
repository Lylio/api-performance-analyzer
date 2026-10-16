
package com.lyle.apiperformance.service;

import com.lyle.apiperformance.dto.PerformanceSummary;
import com.lyle.apiperformance.dto.PerformanceResult;
import com.lyle.apiperformance.dto.ConcurrentPerformanceSummary;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Semaphore;

@Service
public class PerformanceService {
    private static final Logger log = LoggerFactory.getLogger(PerformanceService.class);


    private final PercentileCalculator percentileCalculator;

    private final HttpRequestExecutor httpExecutor;
    private final TargetValidator targetValidator;

    public PerformanceService(PercentileCalculator percentileCalculator,
                              HttpRequestExecutor httpExecutor, TargetValidator targetValidator) {
        this.percentileCalculator = percentileCalculator;
        this.httpExecutor = httpExecutor;
        this.targetValidator = targetValidator;
    }


    public PerformanceResult measureResponseTime(String url)
            throws IOException, InterruptedException {

        targetValidator.validate(url);
        return executeRequest(url);
    }

    public List<String> approvedTargets() {
        return targetValidator.approvedTargets();
    }

    private PerformanceResult executeRequest(String url) throws InterruptedException {
        long start = System.nanoTime();
        int statusCode;
        try {
            statusCode = httpExecutor.execute(url);
        } catch (IOException exception) {
            log.warn("HTTP request failed for {}: {}", url, exception.toString());
            // No HTTP response was received; retain the existing result schema.
            statusCode = 0;
        }
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        return new PerformanceResult(url, statusCode, elapsedMs,
                statusCode >= 200 && statusCode < 300);
    }


    public PerformanceSummary analyzePerformance(
            String url,
            int requestCount
    ) throws IOException, InterruptedException {

        if (requestCount < 1 || requestCount > 100) {
            throw new IllegalArgumentException(
                    "Request count must be between 1 and 100"
            );
        }

        targetValidator.validate(url);

        List<Long> responseTimes = new ArrayList<>();
        int successfulRequests = 0;

        for (int i = 0; i < requestCount; i++) {

            PerformanceResult result = executeRequest(url);

            responseTimes.add(result.responseTimeMs());

            if (result.success()) {
                successfulRequests++;
            }
        }

        responseTimes.sort(Long::compareTo);

        long totalTime = 0;

        for (long time : responseTimes) {
            totalTime += time;
        }

        long averageTime = totalTime / requestCount;

        long minTime = responseTimes.get(0);
        long maxTime = responseTimes.get(requestCount - 1);

        double successRate =
                (successfulRequests * 100.0) / requestCount;


        long p50 = percentileCalculator.calculate(responseTimes, 50);
        long p95 = percentileCalculator.calculate(responseTimes, 95);
        long p99 = percentileCalculator.calculate(responseTimes, 99);


        return new PerformanceSummary(
                url,
                requestCount,
                averageTime,
                minTime,
                maxTime,
                successRate,
                p50,
                p95,
                p99
        );
    }


    public ConcurrentPerformanceSummary analyzeConcurrently(
            String url,
            int requestCount,
            int concurrencyLevel
    ) throws InterruptedException, ExecutionException {

        if (requestCount < 1 || requestCount > 100) {
            throw new IllegalArgumentException(
                    "Request count must be between 1 and 100"
            );
        }

        if (concurrencyLevel < 1 || concurrencyLevel > 10) {
            throw new IllegalArgumentException(
                    "Concurrency level must be between 1 and 10"
            );
        }

        targetValidator.validate(url);

        List<Long> responseTimes = new ArrayList<>();
        int successfulRequests = 0;

        Semaphore semaphore = new Semaphore(concurrencyLevel);

        long startTime = System.nanoTime();

        try (ExecutorService executor =
                     Executors.newVirtualThreadPerTaskExecutor()) {

            List<Future<PerformanceResult>> futures =
                    new ArrayList<>();

            for (int i = 0; i < requestCount; i++) {

                futures.add(executor.submit(() -> {

                    semaphore.acquire();

                    try {
                        return executeRequest(url);
                    } finally {
                        semaphore.release();
                    }
                }));
            }

            try {
                for (Future<PerformanceResult> future : futures) {

                    PerformanceResult result = future.get();

                    responseTimes.add(result.responseTimeMs());

                    if (result.success()) {
                        successfulRequests++;
                    }
                }
            } catch (InterruptedException | ExecutionException exception) {
                futures.forEach(future -> future.cancel(true));
                throw exception;
            }
        }

        long elapsedNanos = System.nanoTime() - startTime;

        long totalExecutionTimeMs =
                elapsedNanos / 1_000_000;

        responseTimes.sort(Long::compareTo);

        long totalResponseTime = 0;

        for (long time : responseTimes) {
            totalResponseTime += time;
        }

        long averageTime = totalResponseTime / requestCount;

        long minTime = responseTimes.get(0);
        long maxTime = responseTimes.get(requestCount - 1);

        double successRate =
                (successfulRequests * 100.0) / requestCount;

        double throughput =
                requestCount * 1_000_000_000.0
                        / Math.max(1L, elapsedNanos);

        long p50 = percentileCalculator.calculate(responseTimes, 50);
        long p95 = percentileCalculator.calculate(responseTimes, 95);
        long p99 = percentileCalculator.calculate(responseTimes, 99);

        return new ConcurrentPerformanceSummary(
                url,
                requestCount,
                concurrencyLevel,
                totalExecutionTimeMs,
                throughput,
                averageTime,
                minTime,
                maxTime,
                successRate,
                p50,
                p95,
                p99
        );
    }


}
