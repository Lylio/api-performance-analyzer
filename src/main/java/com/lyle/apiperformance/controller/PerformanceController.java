package com.lyle.apiperformance.controller;

import com.lyle.apiperformance.dto.PerformanceResult;
import com.lyle.apiperformance.service.PerformanceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.lyle.apiperformance.dto.PerformanceSummary;
import com.lyle.apiperformance.dto.ConcurrentPerformanceSummary;
import java.util.concurrent.ExecutionException;

import java.io.IOException;

@RestController
@RequestMapping("/api/performance")
public class PerformanceController {

    private final PerformanceService performanceService;

    public PerformanceController(PerformanceService performanceService) {
        this.performanceService = performanceService;
    }


    @GetMapping("/test")
    public PerformanceResult test(@RequestParam String url)
            throws IOException, InterruptedException {

        return performanceService.measureResponseTime(url);
    }


    @GetMapping("/analyze")
    public PerformanceSummary analyze(
            @RequestParam String url,
            @RequestParam int requestCount
    ) throws IOException, InterruptedException {

        return performanceService.analyzePerformance(url, requestCount);
    }


    @GetMapping("/concurrent")
    public ConcurrentPerformanceSummary concurrent(
            @RequestParam String url,
            @RequestParam int requestCount,
            @RequestParam int concurrencyLevel
    ) throws InterruptedException, ExecutionException {

        return performanceService.analyzeConcurrently(
                url,
                requestCount,
                concurrencyLevel
        );
    }

}
