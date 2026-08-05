# lemma lem:commuting-square-expansion

## statement

Let $a$ and $b$ belong to an associative ring and suppose that $ab=ba$. Then

\[
(a+b)^2=a^2+2ab+b^2,
\]

where $2ab$ denotes $ab+ab$.

## proof

By the definition of a square and the two distributive laws,

\[
\begin{aligned}
(a+b)^2
  &=(a+b)(a+b)\\
  &=a(a+b)+b(a+b)\\
  &=a^2+ab+ba+b^2.
\end{aligned}
\]

Because $ab=ba$, the two middle terms satisfy

\[
ab+ba=ab+ab=2ab.
\]

Substitution in the preceding expansion gives

\[
(a+b)^2=a^2+2ab+b^2.
\]

# theorem thm:binomial-square-identity

## statement

show that for each a, b
(a+b)^2 = a^2 + 2ab + b^2

## proof

Let $a$ and $b$ be arbitrary numbers in the ordinary elementary-algebra setting implicit in the statement. Multiplication of numbers is commutative, so $ab=ba$. Therefore Lemma `lem:commuting-square-expansion` applies and yields

\[
(a+b)^2=a^2+2ab+b^2.
\]

Since $a$ and $b$ were arbitrary, the identity holds for every $a,b$. The same calculation also proves the identity for arbitrary elements of any commutative ring.
