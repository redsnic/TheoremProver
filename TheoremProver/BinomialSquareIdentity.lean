import Mathlib

/-! Confirmed through the local proof workflow. -/

theorem binomial_square_identity {R : Type*} [CommRing R] (a b : R) : (a + b) ^ 2 = a ^ 2 + 2 * a * b + b ^ 2 := by
  ring
