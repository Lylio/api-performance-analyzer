package com.lyle.apiperformance.dto;

public record PerformanceResult(
        String url,
        int statusCode,
        long responseTimeMs,
        boolean success
) {
}
