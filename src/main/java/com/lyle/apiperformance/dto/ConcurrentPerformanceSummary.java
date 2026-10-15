
package com.lyle.apiperformance.dto;

public record ConcurrentPerformanceSummary(
        String url,
        int totalRequests,
        int concurrencyLevel,
        long totalExecutionTimeMs,
        double throughputRequestsPerSecond,
        long averageResponseTimeMs,
        long minResponseTimeMs,
        long maxResponseTimeMs,
        double successRate,
        long p50ResponseTimeMs,
        long p95ResponseTimeMs,
        long p99ResponseTimeMs
) {
}

