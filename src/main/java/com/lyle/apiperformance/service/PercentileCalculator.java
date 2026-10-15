
package com.lyle.apiperformance.service;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PercentileCalculator {

    public long calculate(
            List<Long> sortedTimes,
            int percentile
    ) {
        if (sortedTimes == null || sortedTimes.isEmpty()) {
            throw new IllegalArgumentException(
                    "Response times cannot be empty"
            );
        }

        if (percentile < 1 || percentile > 100) {
            throw new IllegalArgumentException(
                    "Percentile must be between 1 and 100"
            );
        }

        int index = (int) Math.ceil(
                percentile / 100.0 * sortedTimes.size()
        ) - 1;

        return sortedTimes.get(index);
    }
}

