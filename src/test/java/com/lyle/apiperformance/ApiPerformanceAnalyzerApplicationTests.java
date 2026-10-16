package com.lyle.apiperformance;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "pulse.approved-targets=http://localhost:8081/actuator/health")
class ApiPerformanceAnalyzerApplicationTests {

    @org.springframework.beans.factory.annotation.Autowired
    com.lyle.apiperformance.service.TargetValidator validator;

	@Test
	void contextLoads() {
        org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of("http://localhost:8081/actuator/health"),
                validator.approvedTargets());
	}

}
