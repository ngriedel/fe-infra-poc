package com.aic.esl;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Throwaway stand-in for the downstream insurance API ("ESL"). Exists only to
 * give the BFFs a real OpenAPI source + user-scoped responses to develop the
 * upstream contract against. Not production code; not an Nx project.
 */
@SpringBootApplication
@OpenAPIDefinition(
    info =
        @Info(
            title = "AIC ESL (stub)",
            version = "1.0.0",
            description = "Throwaway upstream for the AIC POC end-to-end slice."))
public class EslApplication {
  public static void main(String[] args) {
    SpringApplication.run(EslApplication.class, args);
  }
}
