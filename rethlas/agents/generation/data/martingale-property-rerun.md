# Problem
X(t) is a stochastic process associated to a MAK chemical reaction network for which the markov property holds.
Given L(y_i | X(t_i)) be a gaussian likelihood coming from the obs model y = x + eps where eps is normally distributed (N(0,sigma)). X(t_i) the state of a Chemical Reaction Network at time t_i; g a real valued output function on the same domain as X(t_i). Let 1..n be the measurement time indexes and let X(t) be known. show that E[ g(X(t_n)) prod_{i=k+1}^{n} L(y_i|X(t_i)) | X(t)] is a martingale.
