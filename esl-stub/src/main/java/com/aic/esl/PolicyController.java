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
 *
 * <p>The Policy record is deliberately FAT — the four meaningful fields plus 20
 * filler ones — to stand in for a real enterprise record that carries far more
 * than any single frontend needs. Each BFF projects this down to just the subset
 * its own frontend uses; see the per-audience contracts in libs/&lt;audience&gt;/contracts.
 */
@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "policies", description = "User-scoped insurance policies (stub data).")
public class PolicyController {


  public record Identity(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String userId,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles) {}

  /**
   * The full upstream record. Mixed types on purpose so the per-audience
   * projections have something real to narrow.
   */
  public record Policy(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String product,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int monthlyPremium,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldA,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldB,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldC,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldD,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fieldE,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldF,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldG,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fieldH,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldI,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldJ,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldK,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fieldL,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldM,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldN,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldO,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldP,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fieldQ,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int fieldR,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldS,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fieldT) {}

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
        buildPolicy("POL-" + (seed % 9000 + 1000), "Motor Comprehensive", "ACTIVE", 850 + seed % 400, seed),
        buildPolicy("POL-" + (seed % 8000 + 2000), "Home Contents", "ACTIVE", 320 + seed % 200, seed + 7));
  }

  /** Fills the 20 filler fields deterministically so responses are stable per user. */
  private static Policy buildPolicy(String id, String product, String status, int premium, int seed) {
    return new Policy(
        id,
        product,
        status,
        premium,
        "A-" + (seed % 100),
        "B-" + (seed % 250),
        seed % 1000,
        seed % 37,
        seed % 2 == 0,
        "F-" + (seed % 64),
        seed % 500,
        seed % 3 == 0,
        "I-" + (seed % 88),
        seed % 900,
        "K-" + (seed % 41),
        seed % 5 == 0,
        seed % 640,
        "N-" + (seed % 12),
        seed % 77,
        "P-" + (seed % 19),
        seed % 7 == 0,
        seed % 310,
        "S-" + (seed % 53),
        "T-" + (seed % 29));
  }
}
