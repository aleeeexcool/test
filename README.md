# 🪙 TestToken

**TestToken** is an upgradeable ERC20 token contract built with OpenZeppelin's upgradeable libraries. It includes role-based access control for minting, burning, upgrading, and managing the maximum supply.

---

## ⚙️ Features

- 🔐 **Role-based access control** via `AccessControlUpgradeable`
- 🏗 **UUPS upgradeable** architecture using OpenZeppelin's `UUPSUpgradeable`
- 🧾 **Minting & burning** restricted to specific roles
- 🧱 **Maximum total supply** enforcement with adjustable cap
- 🚫 Custom errors for gas-efficient reverts
- 📈 Admin-controlled supply cap adjustment

---

## 🧱 Contract Structure

### Roles

| Role                 | Description                      |
| -------------------- | -------------------------------- |
| `DEFAULT_ADMIN_ROLE` | Grants and revokes other roles   |
| `MINTER_ROLE`        | Can mint new tokens              |
| `BURNER_ROLE`        | Can burn tokens from any account |
| `UPGRADER_ROLE`      | Can authorize contract upgrades  |

### Storage

- `maxTotalSupply`: The maximum number of tokens that can ever be minted.

---

## 🧪 Initialization

The contract must be initialized using the `initialize` function with the `Init` struct:

```solidity
struct Init {
  address admin;
  address minter;
  address burner;
  address upgrader;
  string name;
  string symbol;
  uint256 maxSupply;
}
```

⚠️ All addresses must be non-zero or the contract will revert with UnexpectedInitializeParams().

# 🔐 Role-Controlled Functions

## `mint(address to, uint256 amount)`

- **Access:** Requires `MINTER_ROLE`
- **Description:** Mints tokens to the specified address.
- **Constraints:** Cannot exceed `maxTotalSupply`.
- **Reverts With:** `MaxSupplyOutOfBound()` if the total supply would exceed the cap.

---

## `burn(address account, uint256 amount)`

- **Access:** Requires `BURNER_ROLE`
- **Description:** Burns tokens from the given address.

---

## `setMaxTotalSupply(uint256 newMaxTotalSupply)`

- **Access:** Requires `DEFAULT_ADMIN_ROLE`
- **Description:** Updates the `maxTotalSupply` of the token.
- **Emits:** `MaxSupplyChanged(newMaxTotalSupply)`
- **Constraints:** New max supply must be greater than or equal to current total supply.
- **Reverts With:** `CannotBeLessThanTotalSupply()` if constraint violated.

---

## `_authorizeUpgrade(address newImplementation)`

- **Access:** Requires `UPGRADER_ROLE`
- **Description:** Internal function required for UUPS proxy pattern upgrades. Ensures only authorized addresses can trigger implementation upgrades.

---

# 🔍 Custom Errors

| Error                           | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `UnexpectedInitializeParams()`  | One or more of the required initialization addresses is zero.  |
| `MaxSupplyOutOfBound()`         | Attempted mint would exceed the defined `maxTotalSupply`.      |
| `CannotBeLessThanTotalSupply()` | New max supply is less than the currently minted token supply. |
