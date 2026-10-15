
package com.lyle.apiperformance.dto;

public record PerformanceSummary(
        String url,
        int totalRequests,
        long averageResponseTimeMs,
        long minResponseTimeMs,
        long maxResponseTimeMs,
        double successRate,
        long p50ResponseTimeMs,
        long p95ResponseTimeMs,
        long p99ResponseTimeMs
) {
}


