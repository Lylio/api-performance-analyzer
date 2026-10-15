package com.lyle.apiperformance.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.concurrent.ExecutionException;

@RestControllerAdvice
public class PerformanceExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail invalidRequest(IllegalArgumentException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(InterruptedException.class)
    public ProblemDetail interrupted(InterruptedException exception) {
        Thread.currentThread().interrupt();
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Performance analysis was interrupted");
    }

    @ExceptionHandler(ExecutionException.class)
    public ProblemDetail executionFailed(ExecutionException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Performance analysis could not be completed");
    }
}
