import Mathlib

/-!
# Toolchain smoke test

This module contains one elementary theorem used only to verify the local Lean
and Mathlib installation.
-/

/-- A minimal smoke test showing that Lean and Mathlib elaborate a theorem. -/
theorem toolchain_demo (n : Nat) : n + 0 = n := by
  simp
