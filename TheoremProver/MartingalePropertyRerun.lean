import Mathlib

/-! Confirmed through the local proof workflow. -/

theorem martingale_property
    {Ω : Type*} [mΩ : MeasurableSpace Ω]
    (μ : MeasureTheory.Measure Ω) [MeasureTheory.IsProbabilityMeasure μ]
    (X : NNReal → Ω → ℝ)
    (hX : ∀ s, Measurable (X s))
    (hMarkov : ∀ (s : NNReal) (m : ℕ) (u : Fin m → NNReal)
      (Φ : (Fin m → ℝ) → ℝ),
      (∀ i, s ≤ u i) → Measurable Φ →
      MeasureTheory.Integrable (fun ω ↦ Φ (fun i ↦ X (u i) ω)) μ →
      MeasureTheory.condExp
          (MeasureTheory.Filtration.natural X (fun r ↦ (hX r).stronglyMeasurable) s) μ
          (fun ω ↦ Φ (fun i ↦ X (u i) ω)) =ᵐ[μ]
        MeasureTheory.condExp (MeasurableSpace.comap (X s) inferInstance) μ
          (fun ω ↦ Φ (fun i ↦ X (u i) ω)))
    (n : ℕ)
    (t : Fin (n + 1) → NNReal)
    (ht0 : t 0 = 0)
    (ht : StrictMono t)
    (k : Fin n)
    (y : Fin n → ℝ)
    (v : NNReal)
    (hv : v ≠ 0)
    (g : ℝ → ℝ)
    (hg : Measurable g)
    (hZ : MeasureTheory.Integrable
      (fun ω ↦
        g (X (t (Fin.last n)) ω) *
          ∏ i ∈ Finset.univ.filter (fun i : Fin n ↦ k.val ≤ i.val),
            ProbabilityTheory.gaussianPDFReal (X (t i.succ) ω) v (y i))
      μ)
    (ℱI : MeasureTheory.Filtration (Set.Icc (t k.castSucc) (t k.succ)) mΩ)
    (hℱI : ∀ s,
      ℱI s = MeasureTheory.Filtration.natural X
        (fun r ↦ (hX r).stronglyMeasurable) s.1) :
    MeasureTheory.Martingale
      (fun s : Set.Icc (t k.castSucc) (t k.succ) ↦
        MeasureTheory.condExp (MeasurableSpace.comap (X s.1) inferInstance) μ
          (fun ω ↦
            g (X (t (Fin.last n)) ω) *
              ∏ i ∈ Finset.univ.filter (fun i : Fin n ↦ k.val ≤ i.val),
                ProbabilityTheory.gaussianPDFReal (X (t i.succ) ω) v (y i)))
      ℱI μ := by
  let Z : Ω → ℝ := fun ω ↦
    g (X (t (Fin.last n)) ω) *
      ∏ i ∈ Finset.univ.filter (fun i : Fin n ↦ k.val ≤ i.val),
        ProbabilityTheory.gaussianPDFReal (X (t i.succ) ω) v (y i)
  let u : Fin (n + 1) → NNReal := fun j ↦
    if k.val < j.val then t j else t (Fin.last n)
  let Φ : (Fin (n + 1) → ℝ) → ℝ := fun z ↦
    g (z (Fin.last n)) *
      ∏ i ∈ Finset.univ.filter (fun i : Fin n ↦ k.val ≤ i.val),
        ProbabilityTheory.gaussianPDFReal (z i.succ) v (y i)
  have hΦ : Measurable Φ := by
    dsimp [Φ]
    apply (hg.comp (measurable_pi_apply (Fin.last n))).mul
    apply Finset.measurable_prod
    intro i hi
    unfold ProbabilityTheory.gaussianPDFReal
    fun_prop
  have hcomp : (fun ω ↦ Φ (fun j ↦ X (u j) ω)) = Z := by
    funext ω
    dsimp [Φ, Z]
    congr 1
    · have hkLast : k.val < (Fin.last n).val := by
        exact k.isLt
      simp only [u, if_pos hkLast]
    · apply Finset.prod_congr rfl
      intro i hi
      have hki : k.val ≤ i.val := (Finset.mem_filter.mp hi).2
      have hkiSucc : k.val < i.succ.val := by
        simpa only [Fin.val_succ] using Nat.lt_succ_of_le hki
      simp only [u, if_pos hkiSucc]
  have hfuture (s : Set.Icc (t k.castSucc) (t k.succ)) : ∀ j, s.1 ≤ u j := by
    intro j
    dsimp [u]
    split_ifs with hkj
    · apply le_trans s.2.2
      apply ht.monotone
      rw [Fin.le_iff_val_le_val]
      simpa only [Fin.val_succ] using Nat.succ_le_iff.mpr hkj
    · apply le_trans s.2.2
      exact ht.monotone (Fin.le_last k.succ)
  have hZ' : MeasureTheory.Integrable Z μ := by
    simpa only [Z] using hZ
  have hcomp_integrable :
      MeasureTheory.Integrable (fun ω ↦ Φ (fun j ↦ X (u j) ω)) μ := by
    rw [hcomp]
    exact hZ'
  have hMarkovI (s : Set.Icc (t k.castSucc) (t k.succ)) :
      MeasureTheory.condExp (ℱI s) μ Z =ᵐ[μ]
        MeasureTheory.condExp (MeasurableSpace.comap (X s.1) inferInstance) μ Z := by
    rw [hℱI s]
    simpa only [hcomp] using
      hMarkov s.1 (n + 1) u Φ (hfuture s) hΦ hcomp_integrable
  change MeasureTheory.Martingale
    (fun s : Set.Icc (t k.castSucc) (t k.succ) ↦
      MeasureTheory.condExp (MeasurableSpace.comap (X s.1) inferInstance) μ Z)
    ℱI μ
  refine ⟨?_, ?_⟩
  · intro s
    apply MeasureTheory.stronglyMeasurable_condExp.mono
    rw [hℱI s]
    change MeasurableSpace.comap (X s.1) inferInstance ≤
      ⨆ j, ⨆ (_ : j ≤ s.1), MeasurableSpace.comap (X j) inferInstance
    exact le_iSup_of_le s.1 (le_iSup_of_le le_rfl le_rfl)
  · intro r s hrs
    calc
      MeasureTheory.condExp (ℱI r) μ
          (MeasureTheory.condExp (MeasurableSpace.comap (X s.1) inferInstance) μ Z)
          =ᵐ[μ]
        MeasureTheory.condExp (ℱI r) μ (MeasureTheory.condExp (ℱI s) μ Z) :=
          MeasureTheory.condExp_congr_ae (hMarkovI s).symm
      _ =ᵐ[μ] MeasureTheory.condExp (ℱI r) μ Z :=
        ℱI.condExp_condExp Z hrs
      _ =ᵐ[μ]
        MeasureTheory.condExp (MeasurableSpace.comap (X r.1) inferInstance) μ Z :=
          hMarkovI r
