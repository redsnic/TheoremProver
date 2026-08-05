# lemma lem:double-product

## statement

For all real numbers \(a\) and \(b\),

\[
ab+ab=2ab.
\]

Here juxtaposition denotes ordinary real multiplication, and \(2=1+1\).

## proof

Let \(a,b\in\mathbb R\) be arbitrary. The real numbers form a field, so their multiplication is associative and distributive over addition and has identity \(1\). Consequently,

\[
2ab
=2(ab)
=(1+1)(ab)
=1(ab)+1(ab)
=ab+ab.
\]

The first equality uses associativity of multiplication; the second uses \(2=1+1\); the third uses distributivity; and the last uses the multiplicative-identity law. Reversing this equality gives \(ab+ab=2ab\), as required.

# theorem thm:tutorial-square

## statement

Prove that for all real numbers a and b,

(a + b)^2 = a^2 + 2ab + b^2.

State all assumptions explicitly and provide a complete proof.

## proof

**Assumptions and notation.** Let \(a,b\in\mathbb R\) be arbitrary. Addition and multiplication are the usual operations on the real numbers. We use the standard real-field laws: addition is associative; multiplication is associative and commutative, has identity \(1\), and distributes over addition. We write \(x^2=x\cdot x\), use juxtaposition for multiplication, and identify the real number \(2\) with \(1+1\). There are no further assumptions on \(a\) or \(b\); in particular, they need not be nonzero or positive.

By the definition of a square and then the two distributive laws,

\[
\begin{aligned}
(a+b)^2
  &=(a+b)(a+b)\\
  &=a(a+b)+b(a+b)\\
  &=(a^2+ab)+(ba+b^2).
\end{aligned}
\]

Associativity of addition lets us regroup the four summands. Commutativity of real multiplication gives \(ba=ab\). Therefore, using the preceding lemma in the last step,

\[
\begin{aligned}
(a+b)^2
  &=a^2+(ab+ba)+b^2\\
  &=a^2+(ab+ab)+b^2\\
  &=a^2+2ab+b^2.
\end{aligned}
\]

Because \(a\) and \(b\) were arbitrary real numbers and no additional restriction was imposed, this proves the stated identity for all \(a,b\in\mathbb R\).
