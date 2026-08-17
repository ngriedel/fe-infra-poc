package com.aic.esl;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * User-scoped policy data. The caller's identity arrives as plain forwarded
 * headers (the BFF injects them; HMAC-wrapping is a prod concern, skipped here).
 */
@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "policies", description = "User-scoped insurance policies (stub data).")
public class PolicyController {

  public record Identity(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String userId,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles) {}

  public record Policy(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String product,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int monthlyPremium) {}

  @GetMapping("/me")
  @Operation(summary = "Echo the identity the BFF forwarded (dev sanity check).")
  public Identity me(
      @Parameter(description = "Opaque user id forwarded by the BFF")
          @RequestHeader(value = "X-User-Id", required = false) String userId,
      @RequestHeader(value = "X-User-Email", required = false) String email,
      @RequestHeader(value = "X-User-Roles", required = false) String roles) {
    List<String> roleList =
        (roles == null || roles.isBlank()) ? List.of() : List.of(roles.split(","));
    return new Identity(userId, email, roleList);
  }

  @GetMapping("/policies")
  @Operation(summary = "List the policies owned by the identified user.")
  public List<Policy> policies(
      @Parameter(description = "Opaque user id forwarded by the BFF")
          @RequestHeader(value = "X-User-Id", required = false) String userId) {
    String owner = (userId == null || userId.isBlank()) ? "anonymous" : userId;
    // Deterministic stub data derived from the identity, so different users see
    // different results — proving the BFF forwards identity end-to-end.
    int seed = Math.abs(owner.hashCode());
    return List.of(
        new Policy("POL-" + (seed % 9000 + 1000), "Motor Comprehensive", "ACTIVE", 850 + seed % 400),
        new Policy("POL-" + (seed % 8000 + 2000), "Home Contents", "ACTIVE", 320 + seed % 200));
  }
}
