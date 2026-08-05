# lemma lem:gaussian-bound

## statement

Let the observation likelihood be induced by additive nondegenerate Gaussian noise. Then every likelihood function
\[
\ell_i(x):=L(y_i\mid x)
\]
is bounded as a function of \(x\). Consequently, for fixed \(k\in\{0,\ldots,n-1\}\),
\[
Z_k:=g(X(t_n))\prod_{i=k+1}^{n}\ell_i(X(t_i))
\]
is integrable whenever \(g(X(t_n))\) is integrable. More generally, the only integrability hypothesis needed below is \(Z_k\in L^1\).

## proof

For scalar noise \(\varepsilon\sim N(0,\sigma^2)\), with \(\sigma>0\),
\[
\ell_i(x)=\frac{1}{\sqrt{2\pi}\sigma}
 \exp\!\left(-\frac{(y_i-x)^2}{2\sigma^2}\right)
 \leq \frac{1}{\sqrt{2\pi}\sigma}.
\]
(If the notation \(N(0,\sigma)\) uses \(\sigma\) for the variance rather than the standard deviation, only the displayed normalizing constant changes.) In dimension \(d\), with positive-definite covariance matrix \(\Sigma\), the same argument gives
\[
\ell_i(x)\leq (2\pi)^{-d/2}(\det\Sigma)^{-1/2}.
\]
Thus, with \(C\) denoting the relevant Gaussian bound,
\[
|Z_k|\leq C^{\,n-k}|g(X(t_n))|.
\]
The claimed sufficient condition follows. The weaker assumption \(Z_k\in L^1\) is precisely what is required in order that the ordinary conditional expectations and martingale below be integrable. \(\square\)

# lemma lem:future-functional-markov-property

## statement

Let \(X=(X(t))_{t\geq0}\) be a Markov process with its natural filtration
\[
\mathcal F_t^X:=\sigma\{X(u):0\leq u\leq t\},
\]
completed if desired. Fix \(t\geq0\). If \(u_1,\ldots,u_m\geq t\) and
\[
Z=\Phi(X(u_1),\ldots,X(u_m))\in L^1
\]
for a measurable real-valued function \(\Phi\), then
\[
\mathbb E[Z\mid\mathcal F_t^X]
=\mathbb E[Z\mid\sigma(X(t))]
\qquad\text{almost surely}. \tag{1}
\]

## proof

The Markov property says that, conditionally on the present state \(X(t)\), the future is conditionally independent of the past \(\mathcal F_t^X\). Equivalently, for every bounded measurable functional \(H\) of finitely many states at times not earlier than \(t\),
\[
\mathbb E[H\mid\mathcal F_t^X]
=\mathbb E[H\mid\sigma(X(t))]. \tag{2}
\]
If one takes the one-future-time conditional-expectation identity as the definition of the Markov property, (2) follows first for products of bounded one-coordinate functions by induction over the ordered future times, and then for all bounded measurable \(H\) by the monotone-class theorem.

It remains only to pass from bounded \(H\) to the integrable \(Z\) in the statement. Define the truncations
\[
Z^{(r)}:=(-r)\vee(Z\wedge r),\qquad r\geq1.
\]
Each \(Z^{(r)}\) is a bounded measurable functional of the same future states, so (2) applies to \(Z^{(r)}\). Moreover, \(Z^{(r)}\to Z\) in \(L^1\). Conditional expectation is an \(L^1\)-contraction, and hence
\[
\left\|\mathbb E[Z^{(r)}-Z\mid\mathcal F_t^X]\right\|_1
 \leq \|Z^{(r)}-Z\|_1\longrightarrow0,
\]
with the identical estimate after conditioning on \(\sigma(X(t))\). Passing to the \(L^1\) limit in (2) proves (1). \(\square\)

# lemma lem:fixed-payoff-projection

## statement

Let \(Z\in L^1\), let \(I\) be an interval of times, and suppose that
\[
\mathbb E[Z\mid\mathcal F_t^X]
=\mathbb E[Z\mid\sigma(X(t))]
\quad\text{for every }t\in I. \tag{3}
\]
Then
\[
M_t:=\mathbb E[Z\mid\sigma(X(t))],\qquad t\in I,
\]
is a martingale with respect to \((\mathcal F_t^X)_{t\in I}\).

## proof

The random variable \(M_t\) is \(\sigma(X(t))\)-measurable and therefore \(\mathcal F_t^X\)-measurable. Conditional Jensen's inequality gives
\[
\mathbb E|M_t|\leq\mathbb E|Z|<\infty.
\]
Finally, if \(s\leq t\) are in \(I\), then (3) and the tower property give
\[
\begin{aligned}
\mathbb E[M_t\mid\mathcal F_s^X]
&=\mathbb E\!\left[\mathbb E[Z\mid\mathcal F_t^X]\mid\mathcal F_s^X\right]\\
&=\mathbb E[Z\mid\mathcal F_s^X]\\
&=M_s.
\end{aligned}
\]
Thus all three martingale conditions—adaptedness, integrability, and the conditional-mean identity—hold. \(\square\)

# proposition prop:precise-scope

## statement

Fix \(k\in\{0,\ldots,n-1\}\), assume \(t_1<\cdots<t_n\), and treat the observed values \(y_1,\ldots,y_n\) as fixed. If \(Z_k\in L^1\), then
\[
M_t^{(k)}
:=\mathbb E\!\left[
g(X(t_n))\prod_{i=k+1}^{n}L(y_i\mid X(t_i))
\,\middle|\,X(t)
\right] \tag{4}
\]
is a martingale in \(t\), relative to the natural filtration of \(X\), on every time interval contained in \(\{t:t\leq t_{k+1}\}\); in particular it is a martingale on \([t_k,t_{k+1}]\) (with the convention \(t_0=0\) when needed).

The restriction that \(k\) is fixed and that \(t\leq t_{k+1}\) is essential to this assertion: it keeps the random payoff inside (4) fixed and makes every factor in it a present-or-future functional.

## proof

Write \(\ell_i(x)=L(y_i\mid x)\) and use the fixed payoff
\[
Z_k=g(X(t_n))\prod_{i=k+1}^{n}\ell_i(X(t_i)).
\]
If \(t\leq t_{k+1}\), then every time \(t_i\), \(i\geq k+1\), is at least \(t\). Hence \(Z_k\) is a measurable functional of finitely many states in the future of \(t\). Lemma lem:future-functional-markov-property therefore yields
\[
M_t^{(k)}
=\mathbb E[Z_k\mid\sigma(X(t))]
=\mathbb E[Z_k\mid\mathcal F_t^X]. \tag{5}
\]
Lemma lem:fixed-payoff-projection, applied to the single integrable random variable \(Z_k\), now proves the martingale assertion.

The last sentence explains the scope rather than adding a proof hypothesis covertly. A single conditional expectation at one fixed \(t\) is only a random variable, so “is a martingale” necessarily refers to the family indexed by \(t\). Likewise, changing \(k\) changes \(Z_k\), and once \(t>t_{k+1}\), the factor \(\ell_{k+1}(X(t_{k+1}))\) is a past functional not generally determined by \(X(t)\). The Markov identification (5) is then unavailable, and the unrestricted claim is false in general. \(\square\)

# theorem thm:martingale-property

## statement

X(t) is a stochastic process associated to a MAK chemical reaction network for which the markov property holds.
Given L(y_i | X(t_i)) be a gaussian likelihood coming from the obs model y = x + eps where eps is normally distributed (N(0,sigma)). X(t_i) the state of a Chemical Reaction Network at time t_i; g a real valued output function on the same domain as X(t_i). Let 1..n be the measurement time indexes and let X(t) be known. show that E[ g(X(t_n)) prod_{i=k+1}^{n} L(y_i|X(t_i)) | X(t)] is a martingale.

Precisely, the well-posed mathematical formulation of the preceding informal statement is the following. Let
\[
0=t_0<t_1<\cdots<t_n,
\]
fix \(k\in\{0,\ldots,n-1\}\), and regard \(y_1,\ldots,y_n\) as fixed observed values. Let \(X\) be Markov with respect to its natural filtration
\[
\mathcal F_t^X=\sigma\{X(u):0\leq u\leq t\},
\]
and let the Gaussian noise be nondegenerate. For measurable \(g\), assume
\[
Z_k:=g(X(t_n))\prod_{i=k+1}^{n}L(y_i\mid X(t_i))\in L^1.
\]
(It is sufficient that \(\mathbb E|g(X(t_n))|<\infty\).) For \(t\in[t_k,t_{k+1}]\), define
\[
M_t:=\mathbb E[Z_k\mid\sigma(X(t))].
\]
Then \((M_t)_{t\in[t_k,t_{k+1}]}\) is an \((\mathcal F_t^X)\)-martingale.

## proof

We prove the precise formulation included in the statement. Fix \(k\), let \(t\in[t_k,t_{k+1}]\), and use the integrable payoff
\[
Z_k=g(X(t_n))\prod_{i=k+1}^{n}L(y_i\mid X(t_i))
\]
from that formulation. By Lemma lem:gaussian-bound, the stated sufficient condition \(\mathbb E|g(X(t_n))|<\infty\) indeed implies \(Z_k\in L^1\).

The mass-action chemical-reaction-network structure is used here through the assumed Markov property of \(X\). For every \(t\leq t_{k+1}\), all the variables \(X(t_{k+1}),\ldots,X(t_n)\) occurring in \(Z_k\) are present or future states relative to \(t\). The Markov property and Lemma lem:future-functional-markov-property therefore give
\[
\begin{aligned}
M_t
&:=\mathbb E\!\left[
g(X(t_n))\prod_{i=k+1}^{n}L(y_i\mid X(t_i))
\,\middle|\,X(t)
\right]\\
&=\mathbb E[Z_k\mid\mathcal F_t^X]. \tag{6}
\end{aligned}
\]
Thus \(M_t\) is the conditional-expectation process of one fixed integrable terminal random variable. In particular it is adapted and integrable. For \(t_k\leq s\leq t\leq t_{k+1}\), the tower property applied to (6) gives
\[
\mathbb E[M_t\mid\mathcal F_s^X]
=\mathbb E\!\left[
\mathbb E[Z_k\mid\mathcal F_t^X]
\,\middle|\,\mathcal F_s^X
\right]
=\mathbb E[Z_k\mid\mathcal F_s^X]
=M_s.
\]
Hence the process in the question is a martingale on the stated interval. \(\square\)
