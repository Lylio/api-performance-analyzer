
package com.lyle.apiperformance.service;

import com.lyle.apiperformance.dto.PerformanceSummary;
import com.lyle.apiperformance.dto.PerformanceResult;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class PerformanceService {

    public PerformanceResult measureResponseTime(String url)
            throws IOException, InterruptedException {

        if (!url.equals("https://jsonplaceholder.typicode.com/posts")) {
            throw new IllegalArgumentException(
                    "Only the approved test endpoint is currently allowed"
            );
        }

        try (HttpClient client = HttpClient.newHttpClient()) {

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            long startTime = System.nanoTime();

            HttpResponse<Void> response = client.send(
                    request,
                    HttpResponse.BodyHandlers.discarding()
            );

            long endTime = System.nanoTime();

            long responseTimeMs =
                    (endTime - startTime) / 1_000_000;

            int statusCode = response.statusCode();

            boolean success =
                    statusCode >= 200 && statusCode < 300;

            return new PerformanceResult(
                    url,
                    statusCode,
                    responseTimeMs,
                    success
            );
        }
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

        long totalTime = 0;
        long minTime = Long.MAX_VALUE;
        long maxTime = Long.MIN_VALUE;
        int successfulRequests = 0;

        for (int i = 0; i < requestCount; i++) {

            PerformanceResult result = measureResponseTime(url);

            long responseTime = result.responseTimeMs();

            totalTime += responseTime;
            minTime = Math.min(minTime, responseTime);
            maxTime = Math.max(maxTime, responseTime);

            if (result.success()) {
                successfulRequests++;
            }
        }

        long averageTime = totalTime / requestCount;

        double successRate =
                (successfulRequests * 100.0) / requestCount;

        return new PerformanceSummary(
                url,
                requestCount,
                averageTime,
                minTime,
                maxTime,
                successRate
        );
    }

}
