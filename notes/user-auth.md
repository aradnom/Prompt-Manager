Registration flow:
1. Generate memorqable token such as ABCD-EFGH-IJKL
2. Hash with BLAKE2b → token_hash (stored for fast lookup)
3. Derive encryption key from token via KDF
4. Encrypt JSON object { token: "ABCD-EFGH-IJKL", ...future stuff } → account_data
5. Store both token_hash and account_data in DB
6. Generate random encryption key for derived key and set in user's session data
7. Return account_data to user so they can write it down and set generated random encryption key in cookie (separate from session cookie)

Login flow:
1. User enters token
2. Hash with BLAKE2b → lookup user by token_hash
3. Derive encryption key from entered token (same KDF)
4. Decrypt account_data → get plaintext token and any other sensitive info
5. Generate random encryption key for derived key and set in user's session data
6. Return account_data to user so they can write it down and set generated random encryption key in cookie (separate from session cookie)
7. User can now view their token on Account page

Refresh flow (user logged in):
1. Established session is used for most things (userId stored in Redis session data)
2. For Account page specifically, special HTTP-only sessionKey cookie is used to decrypt `encryptedDerivedKey` in session data, which can then be used to decrypt `account_data`, which can then be viewed from Account page