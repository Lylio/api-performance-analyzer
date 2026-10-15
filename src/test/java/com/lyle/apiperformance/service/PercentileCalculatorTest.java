
package com.lyle.apiperformance.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PercentileCalculatorTest {

    private final PercentileCalculator calculator =
            new PercentileCalculator();

    @Test
    void shouldCalculateP50() {

        List<Long> responseTimes =
                List.of(50L, 100L, 150L, 200L, 250L);

        long result = calculator.calculate(responseTimes, 50);

        assertEquals(150L, result);
    }

    @Test
    void shouldCalculateP95() {

        List<Long> responseTimes =
                List.of(50L, 100L, 150L, 200L, 250L);

        long result = calculator.calculate(responseTimes, 95);

        assertEquals(250L, result);
    }

    @Test
    void shouldCalculateP99() {

        List<Long> responseTimes =
                List.of(50L, 100L, 150L, 200L, 250L);

        long result = calculator.calculate(responseTimes, 99);

        assertEquals(250L, result);
    }

    @Test
    void shouldRejectEmptyList() {

        assertThrows(
                IllegalArgumentException.class,
                () -> calculator.calculate(List.of(), 50)
        );
    }

    @Test
    void shouldRejectInvalidPercentile() {

        List<Long> responseTimes = List.of(100L, 200L);

        assertThrows(
                IllegalArgumentException.class,
                () -> calculator.calculate(responseTimes, 101)
        );
    }
}

