
package com.lyle.apiperformance.dto;

public record PerformanceSummary(
        String url,
        int totalRequests,
        long averageResponseTimeMs,
        long minResponseTimeMs,
        long maxResponseTimeMs,
        double successRate
) {
}

