/**
 * Security Rules Verification Suite — "Dirty Dozen" Payload Tests
 * Validates all 12 adversarial payloads specified in security_spec.md.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: 'projects' | 'stylePresets';
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create (ownerId mismatch)',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_spoof_1',
    payload: { ownerId: 'uid_bob', title: 'Spoofed Study' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: false },
    docId: 'proj_unverified_2',
    payload: { ownerId: 'uid_alice', title: 'Unverified Write' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_shadow_3',
    payload: { ownerId: 'uid_alice', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Update',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_shadow_4',
    payload: { isVerifiedCurator: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning Attack (invalid chars / >128 length)',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'bad$id!with*illegal*chars',
    payload: { ownerId: 'uid_alice' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Value Poisoning on Update (oversized title > 120 chars)',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_valid_6',
    payload: { title: 'A'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immortal Field Mutation (mutating createdAt or ownerId)',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_valid_7',
    payload: { ownerId: 'uid_eve' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Forged Client Timestamp',
    collection: 'stylePresets',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'preset_time_8',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded Array Exhaustion (>25 annotations)',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'proj_array_9',
    payload: { annotations: new Array(30).fill({ id: 'box' }) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Private Project Read by Non-Owner',
    collection: 'projects',
    operation: 'get',
    auth: { uid: 'uid_bob', email_verified: true },
    docId: 'private_proj_alice_10',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant Delete on StylePreset',
    collection: 'stylePresets',
    operation: 'delete',
    auth: { uid: 'uid_bob', email_verified: true },
    docId: 'preset_alice_11',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid Enum Medium/Category',
    collection: 'stylePresets',
    operation: 'create',
    auth: { uid: 'uid_alice', email_verified: true },
    docId: 'preset_enum_12',
    payload: { category: 'architecture_3d' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
