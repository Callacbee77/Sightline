# Security Specification — Mise & Gutter Firestore Rules

## 1. Data Invariants

1. **Zero-Trust Default Deny**: Every path not explicitly matched under `/projects/{projectId}` or `/stylePresets/{presetId}` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Enforcement**: Every write operation (`create`, `update`, `delete`) requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Document ID Hardening**: All single-document target operations (`get`, `create`, `update`, `delete`) enforce `isValidId(docId)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Strict Key Allowlisting & Anti-Shadow-Field Guard**:
   - `StudyProject` requires and allows strictly the 16 keys defined in `firebase-blueprint.json`.
   - `StylePreset` requires and allows strictly the 10 keys defined in `firebase-blueprint.json`.
5. **Identity & Ownership Integrity**:
   - On `StudyProject` creation, `incoming().ownerId == request.auth.uid`.
   - On `StylePreset` creation, `incoming().authorId == request.auth.uid`.
   - On update, `ownerId`, `authorId`, and `createdAt` are immutable (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
6. **Temporal Integrity**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().updatedAt == request.time`.
7. **Secure List Queries (Query Enforcer)**:
   - `/projects`: `allow list` requires either `resource.data.isPublic == true` OR (`isSignedIn() && resource.data.ownerId == request.auth.uid`).
   - `/stylePresets`: `allow list` requires either `resource.data.isPublic == true` OR (`isSignedIn() && resource.data.authorId == request.auth.uid`).
8. **Total Array & Map Guarding**:
   - `annotations` in `StudyProject` is a bounded list (`annotations is list && annotations.size() <= 25`) with element type validation when non-empty (`annotations.size() == 0 || annotations[0] is map`).
   - `shaderConfig` and `guidesConfig` are strictly validated maps with bounded keys.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Create)**: Authenticated user `uid_alice` attempts to create `/projects/proj_1` with `ownerId: "uid_bob"`. -> `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Write)**: User with `email_verified: false` attempts to create a valid `/projects/proj_2`. -> `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection on Create)**: User sends valid `StudyProject` payload plus `isAdmin: true`. -> `PERMISSION_DENIED` via `keys().hasOnly(...)`.
4. **Payload 4 (Shadow Field Injection on Update)**: Owner updates `/projects/proj_1` adding `isFeatured: true`. -> `PERMISSION_DENIED` via `affectedKeys().hasOnly(...)`.
5. **Payload 5 (ID Poisoning Attack)**: User attempts to create `/projects/bad$id!with/slashes` or a 200-char ID. -> `PERMISSION_DENIED` via `isValidId()`.
6. **Payload 6 (Value Poisoning on Update)**: Owner updates `title` with a 5,000-character string or integer `12345`. -> `PERMISSION_DENIED` via `isValidStudyProject(incoming())`.
7. **Payload 7 (Immortal Field Mutation)**: Owner attempts to mutate `createdAt` or transfer `ownerId` during `update`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Forged Client Timestamp)**: User supplies a past or future timestamp instead of `request.time` for `createdAt` or `updatedAt`. -> `PERMISSION_DENIED`.
9. **Payload 9 (Unbounded Array Exhaustion)**: User submits `annotations` array with 50 items (`size() > 25`) or non-map elements. -> `PERMISSION_DENIED`.
10. **Payload 10 (Private Project Read by Non-Owner)**: User `uid_bob` attempts `get` or `list` on `/projects/private_proj` where `isPublic == false` and `ownerId == "uid_alice"`. -> `PERMISSION_DENIED`.
11. **Payload 11 (Cross-Tenant Delete)**: User `uid_bob` attempts to `delete` `/stylePresets/preset_1` owned by `uid_alice`. -> `PERMISSION_DENIED`.
12. **Payload 12 (Invalid Enum Medium/Category)**: User creates a `StudyProject` with `medium: "sculpture"` or `StylePreset` with `category: "unknown"`. -> `PERMISSION_DENIED`.
