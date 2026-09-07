// The 37 procedural problem generators, ported from game.js. Each skill has three tiers.
// Prompts use UI Toolkit rich text (<sup>, <sub>, <i>, <color>).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace Numera.Core
{
    public enum ProblemType { Input, Choice }

    public class Problem
    {
        public string Prompt, Hint, Explain, AnswerText; public ProblemType Type;
        public string[] Choices; public int CorrectIndex; public Func<string, bool> Check;
    }

    public static class ProblemGenerators
    {
        static System.Random R;
        static int Ri(int a, int b) => a + R.Next(b - a + 1);
        static T Pick<T>(params T[] xs) => xs[R.Next(xs.Length)];
        static T Pick<T>(IList<T> xs) => xs[R.Next(xs.Count)];
        static List<T> Shuffle<T>(IEnumerable<T> xs) => xs.OrderBy(_ => R.Next()).ToList();
        static int Gcd(int a, int b) { a = Math.Abs(a); b = Math.Abs(b); while (b != 0) { (a, b) = (b, a % b); } return a == 0 ? 1 : a; }
        static string Fmt(double n) => (Math.Round(n * 1e6) / 1e6).ToString(CultureInfo.InvariantCulture);
        static string Fr(object n, object d) => $"<sup>{n}</sup>/<sub>{d}</sub>";
        static (int, int) Simp(int n, int d) { int g = Gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return (n, d); }
        static string FrStr(int n, int d) { (n, d) = Simp(n, d); return d == 1 ? n.ToString() : $"{n}/{d}"; }
        static string Ctx(string s) => $"<i><color=#93a5c4>{s}</color></i>";
        static string Sup(object s) => $"<sup>{s}</sup>";

        public static double? ParseAns(string str)
        {
            if (str == null) return null; str = str.Trim().Replace(",", "");
            if (str.Length == 0) return null;
            var m = Regex.Match(str, @"^(-?\d+)\s+(\d+)\s*/\s*(\d+)$");
            if (m.Success) { double w = double.Parse(m.Groups[1].Value), n = double.Parse(m.Groups[2].Value), d = double.Parse(m.Groups[3].Value); if (d == 0) return null; return (Math.Abs(w) + n / d) * (w < 0 ? -1 : 1); }
            m = Regex.Match(str, @"^(-?\d+(?:\.\d+)?)\s*/\s*(-?\d+(?:\.\d+)?)$");
            if (m.Success) { double d = double.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture); if (d == 0) return null; return double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) / d; }
            if (Regex.IsMatch(str, @"^-?\d+(?:\.\d+)?$")) return double.Parse(str, CultureInfo.InvariantCulture);
            return null;
        }
        static bool NumEq(string guess, double target, double tol = 1e-6) { var v = ParseAns(guess); return v.HasValue && Math.Abs(v.Value - target) <= tol + Math.Abs(target) * 1e-9; }

        static Problem InQ(string q, double ans, string hint, string explain, double tol = 1e-6) => new Problem { Prompt = q, Hint = hint, Explain = explain, Type = ProblemType.Input, Check = s => NumEq(s, ans, tol), AnswerText = Fmt(ans) };
        static Problem FrQ(string q, int n, int d, string hint, string explain) { (n, d) = Simp(n, d); double v = (double)n / d; return new Problem { Prompt = q, Hint = hint, Explain = explain, Type = ProblemType.Input, Check = s => NumEq(s, v, 1e-4), AnswerText = FrStr(n, d) }; }
        static Problem McQ(string q, string correct, IEnumerable<string> wrongs, string hint, string explain)
        {
            var seen = new HashSet<string> { correct }; var w = new List<string>();
            foreach (var x in wrongs) { if (seen.Add(x)) w.Add(x); if (w.Count == 3) break; }
            var ch = Shuffle(new[] { correct }.Concat(w));
            return new Problem { Prompt = q, Hint = hint, Explain = explain, Type = ProblemType.Choice, Choices = ch.ToArray(), CorrectIndex = ch.IndexOf(correct), AnswerText = correct };
        }

        public static Problem Generate(string skill, int t, System.Random rng)
        {
            R = rng;
            switch (skill)
            {
                case "add": return Add(t); case "sub": return Sub(t); case "mul": return Mul(t); case "div": return Div(t);
                case "negadd": return NegAdd(t); case "negmul": return NegMul(t); case "orderops": return OrderOps(t);
                case "fracsimp": return FracSimp(t); case "fracadd": return FracAdd(t); case "fracmul": return FracMul(t);
                case "decops": return DecOps(t); case "percent": return Percent(t); case "percchange": return PercChange(t);
                case "unitrate": return UnitRate(t); case "proportion": return Proportion(t); case "scale": return Scale(t);
                case "powers": return Powers(t); case "exponlaws": return ExponLaws(t); case "scinot": return SciNot(t);
                case "onestep": return OneStep(t); case "twostep": return TwoStep(t); case "distribute": return Distribute(t);
                case "area": return Area(t); case "angles": return Angles(t); case "pythag": return Pythag(t);
                case "linear": return Linear(t); case "quadratic": return Quadratic(t); case "systems": return Systems(t);
                case "righttri": return RightTri(t); case "unitcircle": return UnitCircle(t); case "trigsolve": return TrigSolve(t);
                case "probability": return Probability(t); case "counting": return Counting(t); case "statistics": return Statistics(t);
                case "limits": return Limits(t); case "derivative": return Derivative(t); case "integral": return Integral(t);
                default: return Add(1);
            }
        }

        // ---------- Ember Shore
        static Problem Add(int t)
        {
            if (t == 1) { int a = Ri(12, 89), b = Ri(12, 89); return InQ($"{a} + {b} = ?", a + b, "Add the ones first, then the tens.", $"{a} + {b} = {a + b}."); }
            if (t == 2) { int a = Ri(120, 899), b = Ri(120, 899); return InQ($"{a} + {b} = ?", a + b, "Stack them: ones, tens, hundreds — carry when a column passes 9.", $"{a} + {b} = {a + b}."); }
            int x = Ri(45, 400), y = Ri(45, 400), z = Ri(45, 400);
            return InQ($"{x} + {y} + {z} = ?", x + y + z, "Add two of them first; a running total keeps the tide steady.", $"{x} + {y} = {x + y}, then + {z} = {x + y + z}.");
        }
        static Problem Sub(int t)
        {
            if (t == 1) { int b = Ri(11, 60), a = b + Ri(5, 39); return InQ($"{a} − {b} = ?", a - b, "Count up from the smaller number to the larger.", $"{a} − {b} = {a - b}."); }
            if (t == 2) { int b = Ri(120, 700), a = b + Ri(80, 299); return InQ($"{a} − {b} = ?", a - b, "Borrow from the next column when a digit is too small.", $"{a} − {b} = {a - b}."); }
            int bb = Ri(150, 800), c = Ri(50, 300), aa = bb + c + Ri(40, 200);
            return InQ($"{aa} − {bb} − {c} = ?", aa - bb - c, "Take one bite at a time, left to right.", $"{aa} − {bb} = {aa - bb}, then − {c} = {aa - bb - c}.");
        }
        static Problem Mul(int t)
        {
            if (t == 1) { int a = Ri(3, 12), b = Ri(3, 12); return InQ($"{a} × {b} = ?", a * b, $"Think of {a} rows of {b}.", $"{a} × {b} = {a * b}."); }
            if (t == 2) { int a = Ri(13, 79), b = Ri(3, 9); return InQ($"{a} × {b} = ?", a * b, $"Split it: {a} = {a / 10 * 10} + {a % 10}, multiply each part.", $"{a / 10 * 10}×{b} + {a % 10}×{b} = {a * b}."); }
            int p = Ri(12, 39), q = Ri(12, 29);
            return InQ($"{p} × {q} = ?", p * q, $"Fold it: {p}×{q} = {p}×{q / 10 * 10} + {p}×{q % 10}.", $"{p}×{q / 10 * 10} = {p * (q / 10 * 10)}, {p}×{q % 10} = {p * (q % 10)}; sum = {p * q}.");
        }
        static Problem Div(int t)
        {
            if (t == 1) { int b = Ri(3, 12), q = Ri(3, 12); return InQ($"{b * q} ÷ {b} = ?", q, $"How many {b}s make {b * q}?", $"{b} × {q} = {b * q}, so the answer is {q}."); }
            if (t == 2) { int b = Ri(3, 9), q = Ri(21, 99); return InQ($"{b * q} ÷ {b} = ?", q, "Divide the hundreds/tens first, then the rest.", $"{b} × {q} = {b * q}."); }
            int bb = Ri(11, 25), qq = Ri(12, 40);
            return InQ($"{bb * qq} ÷ {bb} = ?", qq, $"Estimate: {bb} × 10 = {bb * 10}. How many more?", $"{bb} × {qq} = {bb * qq}.");
        }
        // ---------- Hollow of Signs
        static Problem NegAdd(int t)
        {
            if (t == 1) { int a = Ri(2, 15), b = Ri(2, 15); return InQ($"{-a} + {b} = ?", b - a, $"Start at −{a} on the number line and walk right {b}.", $"{-a} + {b} = {b - a}."); }
            if (t == 2) { int a = Ri(5, 30), b = Ri(5, 30); return InQ($"{-a} − {b} = ?", -a - b, "Subtracting a positive walks further left.", $"{-a} − {b} = {-a - b}."); }
            int x = Ri(3, 20), y = Ri(3, 20);
            return InQ($"{x} − (−{y}) = ?", x + y, "Subtracting a negative is adding.", $"{x} − (−{y}) = {x} + {y} = {x + y}.");
        }
        static Problem NegMul(int t)
        {
            if (t == 1) { int a = Ri(2, 12), b = Ri(2, 12), s = Pick(-1, 1); int x = s * a, y = -b; return InQ($"({x}) × ({y}) = ?", x * y, "Same signs give +, different signs give −.", $"Signs {(s < 0 ? "match: positive" : "differ: negative")} → {x * y}."); }
            if (t == 2) { int b = Ri(2, 12), q = Ri(2, 12), s1 = Pick(-1, 1), s2 = Pick(-1, 1); int a = s1 * b * q, d = s2 * b; return InQ($"({a}) ÷ ({d}) = ?", a / d, "Divide the sizes, then settle the sign.", $"{Math.Abs(a)} ÷ {Math.Abs(d)} = {Math.Abs(a / d)}, sign → {a / d}."); }
            int n = Pick(2, 3), aa = Ri(2, 5); int v = (int)Math.Pow(-aa, n);
            return InQ($"(−{aa}){Sup(n)} = ?", v, n == 2 ? "An even power of a negative is positive." : "An odd power of a negative stays negative.", $"(−{aa}) multiplied by itself {n} times = {v}.");
        }
        static Problem OrderOps(int t)
        {
            if (t == 1) { int a = Ri(2, 12), b = Ri(2, 9), c = Ri(2, 9); return InQ($"{a} + {b} × {c} = ?", a + b * c, "Multiplication before addition — always.", $"{b} × {c} = {b * c} first, then + {a} = {a + b * c}."); }
            if (t == 2) { int a = Ri(2, 9), b = Ri(2, 9), c = Ri(2, 6), d = Ri(2, 15); return InQ($"({a} + {b}) × {c} − {d} = ?", (a + b) * c - d, "Parentheses first, then multiply, then subtract.", $"({a + b}) × {c} = {(a + b) * c}, − {d} = {(a + b) * c - d}."); }
            int p = Ri(2, 10), q = Ri(2, 5), r = Ri(2, 4), s = Ri(1, 10);
            return InQ($"{p} + {q} × {r}{Sup(2)} − {s} = ?", p + q * r * r - s, "Exponents, then multiplication, then left-to-right.", $"{r}² = {r * r}; {q}×{r * r} = {q * r * r}; {p} + {q * r * r} − {s} = {p + q * r * r - s}.");
        }
        // ---------- Fraction Cove
        static Problem FracSimp(int t)
        {
            if (t <= 2)
            {
                int d0 = Ri(2, t == 1 ? 6 : 9), n0 = Ri(1, d0 - 1); while (Gcd(n0, d0) != 1) n0 = Ri(1, d0 - 1);
                int g = Ri(2, t == 1 ? 4 : 7); var (sn, sd) = Simp(n0, d0);
                if (t == 1 || R.Next(2) == 0)
                {
                    return new Problem { Prompt = $"Simplify fully: {Fr(n0 * g, d0 * g)}", Hint = $"Both parts divide by {g}.", Explain = $"Divide top and bottom by {g}: {FrStr(n0, d0)}.", Type = ProblemType.Input, AnswerText = FrStr(sn, sd),
                        Check = s => { var m = Regex.Match(s.Trim(), @"^(-?\d+)\s*/\s*(\d+)$"); if (!m.Success) return sd == 1 && NumEq(s, sn); return int.Parse(m.Groups[1].Value) == sn && int.Parse(m.Groups[2].Value) == sd; } };
                }
                return InQ($"{Fr(n0, d0)} = {Fr("?", d0 * g)} — find the missing top.", n0 * g, $"The bottom was multiplied by {g}; do the same on top.", $"{n0} × {g} = {n0 * g}.");
            }
            int d = Pick(3, 4, 5, 6, 8); var fracs = Shuffle(new[] { (1, d), ((d - 1), d), ((d + 1) / 2, d) });
            var best = fracs.OrderByDescending(f => (double)f.Item1 / f.Item2).First();
            return McQ("Which fraction is largest?", FrStr(best.Item1, best.Item2), fracs.Where(f => f != best).Select(f => FrStr(f.Item1, f.Item2)), "Compare each to one half, or give them a common bottom.", $"{FrStr(best.Item1, best.Item2)} = {Fmt((double)best.Item1 / best.Item2)}, the largest.");
        }
        static Problem FracAdd(int t)
        {
            if (t == 1) { int d = Pick(5, 6, 7, 8, 9), a = Ri(1, d - 2), b = Ri(1, d - 1 - a); return FrQ($"{Fr(a, d)} + {Fr(b, d)} = ?", a + b, d, "Same bottoms: just add the tops.", $"{a} + {b} = {a + b}, so {FrStr(a + b, d)}."); }
            if (t == 2) { int d1 = Pick(2, 3, 4); int d2 = Pick(new[] { 3, 4, 5, 6 }.Where(x => x != d1).ToArray()); int a = Ri(1, Math.Max(1, d1 - 1)), b = Ri(1, d2 - 1); int L = d1 * d2 / Gcd(d1, d2); int n = a * L / d1 + b * L / d2; return FrQ($"{Fr(a, d1)} + {Fr(b, d2)} = ?", n, L, $"A common bottom for {d1} and {d2} is {L}.", $"{FrStr(a * L / d1, L)} + {FrStr(b * L / d2, L)} = {FrStr(n, L)}."); }
            int w1 = Ri(1, 3), dd = Pick(3, 4, 5), aa = Ri(1, dd - 1), w2 = Ri(1, 2), bb = Ri(1, dd - 1); int nn = (w1 * dd + aa) + (w2 * dd + bb);
            return FrQ($"{w1} {Fr(aa, dd)} + {w2} {Fr(bb, dd)} = ?  {Ctx("(fraction or mixed number)")}", nn, dd, "Turn each into an improper fraction first.", $"{FrStr(w1 * dd + aa, dd)} + {FrStr(w2 * dd + bb, dd)} = {FrStr(nn, dd)}.");
        }
        static Problem FracMul(int t)
        {
            if (t == 1) { int a = Ri(1, 4), b = Ri(2, 5), c = Ri(1, 4), d = Ri(2, 5); return FrQ($"{Fr(a, b)} × {Fr(c, d)} = ?", a * c, b * d, "Multiply straight across: tops together, bottoms together.", $"{a}×{c} = {a * c}, {b}×{d} = {b * d} → {FrStr(a * c, b * d)}."); }
            if (t == 2) { int a = Ri(1, 4), b = Ri(2, 5), c = Ri(1, 4), d = Ri(2, 5); return FrQ($"{Fr(a, b)} ÷ {Fr(c, d)} = ?", a * d, b * c, "Dividing is multiplying by the flip (the somersault).", $"{Fr(a, b)} × {Fr(d, c)} → {FrStr(a * d, b * c)}."); }
            int w = Ri(1, 2), b2 = Pick(2, 3, 4), a2 = Ri(1, b2 - 1), cc = Ri(2, 4), d2 = Ri(2, 5); int n1 = w * b2 + a2;
            return FrQ($"{w} {Fr(a2, b2)} × {Fr(cc, d2)} = ?", n1 * cc, b2 * d2, "Improper fraction first, then straight across.", $"{FrStr(n1, b2)} × {FrStr(cc, d2)} = {FrStr(n1 * cc, b2 * d2)}.");
        }
        // ---------- Glass Delta
        static Problem DecOps(int t)
        {
            if (t == 1) { double a = Ri(11, 99) / 10.0, b = Ri(11, 99) / 10.0; return InQ($"{Fmt(a)} + {Fmt(b)} = ?", Math.Round((a + b) * 10) / 10, "Line up the decimal points.", $"{Fmt(a)} + {Fmt(b)} = {Fmt(a + b)}.", 1e-4); }
            if (t == 2) { double a = Ri(11, 79) / 10.0; int b = Ri(2, 9); return InQ($"{Fmt(a)} × {b} = ?", Math.Round(a * b * 10) / 10, $"Compute {Fmt(a * 10)} × {b}, then place one decimal digit back.", $"{Fmt(a * 10)} × {b} = {Fmt(a * 10 * b)}, so {Fmt(a * b)}.", 1e-4); }
            double d = Pick(0.2, 0.25, 0.4, 0.5, 0.8); int q = Ri(3, 24); double aa = Math.Round(d * q * 100) / 100;
            return InQ($"{Fmt(aa)} ÷ {Fmt(d)} = ?", q, "Multiply both numbers by 100 to clear the points.", $"{Fmt(aa * 100)} ÷ {Fmt(d * 100)} = {q}.", 1e-4);
        }
        static Problem Percent(int t)
        {
            if (t == 1) { int p = Pick(10, 20, 25, 50, 75, 5), n = Ri(2, 20) * 20; return InQ($"What is {p}% of {n}?", n * p / 100.0, $"{p}% means {p} out of every 100.", $"{n} × {p}/100 = {Fmt(n * p / 100.0)}."); }
            if (t == 2) { int b = Pick(20, 25, 40, 50, 80, 200), p = Pick(10, 20, 25, 30, 40, 60, 75); double a = b * p / 100.0; return InQ($"{Fmt(a)} is what percent of {b}? {Ctx("(no % sign)")}", p, $"Divide the part by the whole: {Fmt(a)}/{b}.", $"{Fmt(a)} ÷ {b} = {Fmt(a / b)} = {p}%."); }
            int pp = Pick(20, 25, 40, 50, 10), nn = Ri(2, 12) * 10; double aa = nn * pp / 100.0;
            return InQ($"{pp}% of what number is {Fmt(aa)}?", nn, $"Work backward: divide {Fmt(aa)} by {pp}/100.", $"{Fmt(aa)} ÷ {Fmt(pp / 100.0)} = {nn}.");
        }
        static Problem PercChange(int t)
        {
            if (t == 1) { int n = Ri(2, 12) * 50, p = Pick(10, 20, 30, 50); return InQ($"A relic worth {n} lumins rises in value by {p}%. New value?", n * (100 + p) / 100.0, $"Add {p}% of {n} to the original.", $"{n} + {n * p / 100} = {n * (100 + p) / 100}."); }
            if (t == 2) { int a = Ri(2, 10) * 20, p = Pick(10, 25, 50, 75, 100); double b = a * (100 + p) / 100.0; return InQ($"A tide-marker rose from {a} to {Fmt(b)}. What percent increase? {Ctx("(no % sign)")}", p, "Percent change = change ÷ original × 100.", $"({Fmt(b)} − {a}) ÷ {a} × 100 = {p}%."); }
            int nn = Ri(2, 8) * 100, pp = Pick(10, 20, 50), qq = Pick(10, 25, 50); double v = nn * (100 + pp) / 100.0 * (100 - qq) / 100.0;
            return InQ($"A pearl costs {nn} lumins, rises {pp}%, then falls {qq}%. Final price?", v, "Apply the changes one at a time — they don’t cancel.", $"{nn} → {nn * (100 + pp) / 100} → {Fmt(v)}.", 1e-3);
        }
        // ---------- Ratio Reef
        static Problem UnitRate(int t)
        {
            if (t == 1) { int k = Ri(3, 9), u = Ri(2, 15); return InQ($"{k} reef-shells cost {k * u} lumins. Cost per shell?", u, $"Divide the total by {k}.", $"{k * u} ÷ {k} = {u} lumins each."); }
            if (t == 2) { int h = Ri(2, 6), v = Ri(3, 15) * 5; return InQ($"A current drifts {h * v} leagues in {h} hours. Leagues per hour?", v, "Rate = distance ÷ time.", $"{h * v} ÷ {h} = {v}."); }
            int uu = Ri(2, 9), k1 = Ri(3, 6), k2 = Ri(7, 12), p1 = k1 * (uu + 1), p2 = k2 * uu;
            return McQ("Which is the better buy for kelp-cakes?", $"{k2} for {p2} lumins", new[] { $"{k1} for {p1} lumins" }, "Compare the price of one cake in each offer.", $"{p2}÷{k2} = {uu} per cake beats {p1}÷{k1} = {uu + 1}.");
        }
        static Problem Proportion(int t)
        {
            if (t == 1) { int a = Ri(2, 6), b = Ri(2, 6), k = Ri(2, 6); return InQ($"Solve for x:  {Fr(a, b)} = {Fr("x", b * k)}", a * k, $"The bottom grew {k}×; the top must too.", $"x = {a} × {k} = {a * k}."); }
            if (t == 2) { int s = Ri(2, 4), f = Ri(2, 5), m = Ri(2, 4); return InQ($"A reef-broth for {s} eels needs {f} cups of brine. How many cups for {s * m} eels?", f * m, "Scale both sides of the recipe equally.", $"{s * m}÷{s} = {m}× the recipe → {f} × {m} = {f * m} cups."); }
            int c = Ri(2, 5), d = Ri(2, 5), aa = c * Ri(2, 5);
            return InQ($"Solve for x:  {Fr(aa, "x")} = {Fr(c, d)}", (double)aa * d / c, "Cross-multiply: a×d = c×x.", $"{aa} × {d} = {c}x → x = {aa * d}/{c} = {Fmt((double)aa * d / c)}.");
        }
        static Problem Scale(int t)
        {
            if (t == 1) { int k = Pick(5, 10, 20, 25, 50), cm = Ri(2, 9); return InQ($"A chart's scale is 1 cm : {k} leagues. How many leagues is {cm} cm?", cm * k, $"Each centimeter stands for {k} leagues.", $"{cm} × {k} = {cm * k} leagues."); }
            if (t == 2) { int a = Ri(2, 6), b = Ri(3, 8), k = Ri(2, 4); return InQ($"Two similar sails: one has sides {a} and {b}; the larger has shortest side {a * k}. Its longer side?", b * k, $"The scale factor is {a * k}÷{a}.", $"Factor {k} → {b} × {k} = {b * k}."); }
            int s = Ri(2, 5); return InQ($"A map is enlarged by scale factor {s}. Area grows by what factor?", s * s, "Length scales by s, so area scales by s × s.", $"{s}² = {s * s}.");
        }
        // ---------- Exponent Peaks
        static Problem Powers(int t)
        {
            if (t == 1) { if (R.Next(2) == 0) { int n = Ri(3, 15); return InQ($"{n}{Sup(2)} = ?", n * n, $"{n} × {n}.", $"{n}² = {n * n}."); } int m = Ri(2, 7); return InQ($"{m}{Sup(3)} = ?", m * m * m, $"{m} × {m} × {m}.", $"{m}³ = {m * m * m}."); }
            if (t == 2) { if (R.Next(2) == 0) { int n = Ri(4, 20); return InQ($"√{n * n} = ?", n, $"What number times itself gives {n * n}?", $"{n} × {n} = {n * n}, so √{n * n} = {n}."); } int m = Ri(2, 6); return InQ($"∛{m * m * m} = ?", m, "Which number cubed gives this?", $"{m}³ = {m * m * m}."); }
            if (R.Next(2) == 0) { int a = Ri(2, 200); return InQ($"{a}{Sup(0)} = ?", 1, "Anything (nonzero) to the power 0…", "Any nonzero number to the 0 is 1."); }
            int aa = Pick(2, 3, 4, 5), nn = Ri(1, 3); int pw = (int)Math.Pow(aa, nn);
            return FrQ($"{aa}{Sup("−" + nn)} = ? {Ctx("(as a fraction)")}", 1, pw, "A negative exponent flips into a fraction.", $"{aa}⁻{nn} = 1/{pw} = {FrStr(1, pw)}.");
        }
        static Problem ExponLaws(int t)
        {
            if (t == 1) { int a = Ri(2, 7), b = Ri(2, 7); return InQ($"x{Sup(a)} · x{Sup(b)} = x{Sup("?")} — find the exponent.", a + b, "Same base multiplied: add the exponents.", $"{a} + {b} = {a + b}."); }
            if (t == 2) { if (R.Next(2) == 0) { int b = Ri(2, 6), a = b + Ri(1, 6); return InQ($"x{Sup(a)} ÷ x{Sup(b)} = x{Sup("?")} — find the exponent.", a - b, "Same base divided: subtract the exponents.", $"{a} − {b} = {a - b}."); } int p = Ri(2, 5), q = Ri(2, 4); return InQ($"(x{Sup(p)}){Sup(q)} = x{Sup("?")} — find the exponent.", p * q, "A power of a power: multiply the exponents.", $"{p} × {q} = {p * q}."); }
            int aa = Ri(2, 3), bb = Ri(2, 3), bs = Pick(2, 3); int v = (int)Math.Pow(bs, aa + bb);
            return InQ($"{bs}{Sup(aa)} · {bs}{Sup(bb)} = ?  {Ctx("(as a number)")}", v, $"First combine: {bs}^{aa + bb}.", $"{bs}^{aa}·{bs}^{bb} = {bs}^{aa + bb} = {v}.");
        }
        static Problem SciNot(int t)
        {
            if (t == 1) { double m = Ri(11, 89) / 10.0; int e = Ri(3, 6); double v = m * Math.Pow(10, e); string vs = ((long)Math.Round(v)).ToString("N0", CultureInfo.InvariantCulture); return McQ($"Write {vs} in scientific notation.", $"{Fmt(m)} × 10^{e}", new[] { $"{Fmt(m)} × 10^{e + 1}", $"{Fmt(m)} × 10^{e - 1}", $"{Fmt(m * 10)} × 10^{e}" }, "Slide the point until one digit remains before it; count the slides.", $"{vs} = {Fmt(m)} × 10^{e}."); }
            if (t == 2) { double m = Ri(11, 89) / 10.0; int e = Ri(2, 5); return InQ($"{Fmt(m)} × 10{Sup(e)} = ?  {Ctx("(as an ordinary number)")}", m * Math.Pow(10, e), $"Slide the decimal point {e} places right.", $"= {Fmt(m * Math.Pow(10, e))}."); }
            int a = Ri(2, 4), b = Ri(2, 4), e1 = Ri(2, 5), e2 = Ri(2, 5), mr = a * b;
            string norm = mr >= 10 ? $"{Fmt(mr / 10.0)} × 10^{e1 + e2 + 1}" : $"{mr} × 10^{e1 + e2}";
            return McQ($"({a} × 10{Sup(e1)}) × ({b} × 10{Sup(e2)}) = ?", norm, new[] { $"{mr} × 10^{e1 + e2 + (mr >= 10 ? 0 : 1)}", $"{mr} × 10^{e1 * e2}", $"{Fmt(mr / (mr >= 10 ? 1.0 : 10.0))} × 10^{e1 + e2 - 1}" }, "Multiply the fronts, add the exponents, then re-normalize if needed.", $"{a}×{b} = {mr}; 10^{e1}·10^{e2} = 10^{e1 + e2}{(mr >= 10 ? "; normalize → " + norm : "")}.");
        }
        // ---------- Algebra Vale
        static Problem OneStep(int t)
        {
            int x = Ri(2, t == 1 ? 12 : 25);
            if (t == 1) { int a = Ri(2, 20); return R.Next(2) == 0 ? InQ($"x + {a} = {x + a}.  x = ?", x, $"Undo the +{a} by subtracting it from both sides.", $"x = {x + a} − {a} = {x}.") : InQ($"x − {a} = {x - a}.  x = ?", x, $"Undo the −{a} by adding it to both sides.", $"x = {x - a} + {a} = {x}."); }
            if (t == 2) { int a = Ri(2, 9); return R.Next(2) == 0 ? InQ($"{a}x = {a * x}.  x = ?", x, $"Undo the ×{a} by dividing both sides.", $"x = {a * x} ÷ {a} = {x}.") : InQ($"x ÷ {a} = {x}.  x = ?", x * a, $"Undo the ÷{a} by multiplying both sides.", $"x = {x} × {a} = {x * a}."); }
            int aa = Ri(2, 9), neg = Ri(2, 30);
            return InQ($"{aa}x = {-aa * neg}.  x = ?", -neg, "Divide both sides — mind the sign.", $"x = {-aa * neg} ÷ {aa} = {-neg}.");
        }
        static Problem TwoStep(int t)
        {
            int x = Ri(2, 12);
            if (t == 1) { int a = Ri(2, 8), b = Ri(2, 20); return InQ($"{a}x + {b} = {a * x + b}.  x = ?", x, $"First subtract {b}, then divide by {a}.", $"{a}x = {a * x} → x = {x}."); }
            if (t == 2) { int a = Ri(2, 8), b = Ri(2, 20); return InQ($"{a}x − {b} = {a * x - b}.  x = ?", x, $"First add {b} to both sides.", $"{a}x = {a * x} → x = {x}."); }
            int aa = Ri(3, 9), c = Ri(1, aa - 2), d = Ri(2, 15);
            return InQ($"{aa}x + {d} = {c}x + {(aa - c) * x + d}.  x = ?", x, $"Gather the x's on one side: subtract {c}x from both.", $"{aa - c}x + {d} = {(aa - c) * x + d} → {aa - c}x = {(aa - c) * x} → x = {x}.");
        }
        static Problem Distribute(int t)
        {
            if (t == 1) { int a = Ri(2, 8), b = Ri(2, 9); return McQ($"Expand:  {a}(x + {b})", $"{a}x + {a * b}", new[] { $"{a}x + {b}", $"{a + b}x", $"{a}x + {a + b}" }, $"Multiply {a} by both things inside.", $"{a}·x + {a}·{b} = {a}x + {a * b}."); }
            if (t == 2) { int a = Ri(2, 7), b = Ri(2, 12), c = Ri(2, 7), d = Ri(2, 12); return McQ($"Combine like terms:  {a}x + {b} + {c}x + {d}", $"{a + c}x + {b + d}", new[] { $"{a + c + b + d}x", $"{a + c}x + {b * d}", $"{a * c}x + {b + d}" }, "x-terms with x-terms, numbers with numbers.", $"({a}+{c})x + ({b}+{d}) = {a + c}x + {b + d}."); }
            int aa = Ri(1, 6), bb = Ri(1, 6);
            return McQ($"Expand:  (x + {aa})(x + {bb})", $"x² + {aa + bb}x + {aa * bb}", new[] { $"x² + {aa * bb}x + {aa + bb}", $"x² + {aa + bb}x + {aa + bb}", $"x² + {aa * bb}" }, "FOIL: firsts, outers, inners, lasts.", $"x·x + {bb}x + {aa}x + {aa * bb} = x² + {aa + bb}x + {aa * bb}.");
        }
        // ---------- Geometry Grove
        static Problem Area(int t)
        {
            if (t == 1) { if (R.Next(2) == 0) { int l = Ri(4, 15), w = Ri(3, 12); return InQ($"A grove plot is {l} by {w} paces. Its area?", l * w, "Area of a rectangle = length × width.", $"{l} × {w} = {l * w} square paces."); } int b = Ri(2, 10) * 2, h = Ri(3, 12); return InQ($"A triangular sail has base {b} and height {h}. Its area?", b * h / 2, "Half of base × height.", $"½ × {b} × {h} = {b * h / 2}."); }
            if (t == 2) { int r = Ri(2, 12); return R.Next(2) == 0 ? McQ($"A circle has radius {r}. Its area?", $"{r * r}π", new[] { $"{2 * r}π", $"{r}π", $"{r * r * 2}π" }, "Area = πr².", $"π × {r}² = {r * r}π.") : McQ($"A circle has radius {r}. Its circumference?", $"{2 * r}π", new[] { $"{r * r}π", $"{r}π", $"{4 * r}π" }, "Circumference = 2πr.", $"2π × {r} = {2 * r}π."); }
            int a = Ri(4, 10), bb = Ri(4, 10), c = Ri(2, a - 1), d = Ri(2, bb - 1);
            return InQ($"{Ctx($"An L-shaped terrace is a {a} × {bb} rectangle with a {c} × {d} corner removed.")}\nArea of the terrace?", a * bb - c * d, "Whole rectangle minus the missing corner.", $"{a}×{bb} − {c}×{d} = {a * bb} − {c * d} = {a * bb - c * d}.");
        }
        static Problem Angles(int t)
        {
            if (t == 1) { int s = Pick(90, 180), a = Ri(15, s - 15); return InQ($"Two angles {(s == 90 ? "are complementary (sum 90°)" : "form a straight line (180°)")}. One is {a}°. The other?", s - a, $"They must total {s}°.", $"{s} − {a} = {s - a}°."); }
            if (t == 2) { int a = Ri(25, 80), b = Ri(25, 80); return InQ($"A triangle has angles {a}° and {b}°. The third angle?", 180 - a - b, "Angles of a triangle total 180°.", $"180 − {a} − {b} = {180 - a - b}°."); }
            if (R.Next(2) == 0) { int n = Ri(5, 12); return InQ($"Sum of interior angles of a {n}-sided polygon?", (n - 2) * 180, "(n − 2) × 180°.", $"({n} − 2) × 180 = {(n - 2) * 180}°."); }
            int nn = Pick(3, 4, 5, 6, 8, 9, 10, 12);
            return InQ($"Each interior angle of a regular {nn}-gon?", 180 - 360.0 / nn, "Each exterior angle is 360°/n; interior = 180° − that.", $"180 − 360/{nn} = {Fmt(180 - 360.0 / nn)}°.");
        }
        static readonly int[][] Triples = { new[] { 3, 4, 5 }, new[] { 5, 12, 13 }, new[] { 8, 15, 17 }, new[] { 7, 24, 25 }, new[] { 6, 8, 10 }, new[] { 9, 12, 15 } };
        static Problem Pythag(int t)
        {
            var T = Pick(Triples);
            if (t == 1) return InQ($"A right triangle has legs {T[0]} and {T[1]}. The hypotenuse?", T[2], "a² + b² = c².", $"√({T[0]}² + {T[1]}²) = √{T[2] * T[2]} = {T[2]}.");
            if (t == 2) return InQ($"A right triangle has hypotenuse {T[2]} and one leg {T[0]}. The other leg?", T[1], "c² − a² = b².", $"√({T[2]}² − {T[0]}²) = √{T[1] * T[1]} = {T[1]}.");
            int x = Ri(-5, 5), y = Ri(-5, 5);
            return InQ($"Distance between ({x}, {y}) and ({x + T[0]}, {y + T[1]})?", T[2], "Build a right triangle from the horizontal and vertical gaps.", $"√({T[0]}² + {T[1]}²) = {T[2]}.");
        }
        // ---------- Function Falls
        static string Sgn(int b) => b < 0 ? "−" : "+";
        static Problem Linear(int t)
        {
            if (t == 1) { int a = Ri(2, 7), b = Ri(-9, 9), x = Ri(2, 8); return InQ($"f(x) = {a}x {Sgn(b)} {Math.Abs(b)}.  f({x}) = ?", a * x + b, $"Feed {x} into the machine.", $"{a}×{x} {Sgn(b)} {Math.Abs(b)} = {a * x + b}."); }
            if (t == 2) { int x1 = Ri(-4, 3), y1 = Ri(-6, 6), m = Ri(-4, 4); if (m == 0) m = 2; int dx = Ri(1, 4); return InQ($"Slope of the line through ({x1}, {y1}) and ({x1 + dx}, {y1 + m * dx})?", m, "Slope = rise ÷ run.", $"({y1 + m * dx} − {y1}) ÷ ({x1 + dx} − {x1}) = {m * dx}/{dx} = {m}."); }
            int mm = Ri(-4, 4); if (mm == 0) mm = 3; int bb = Ri(-8, 8);
            string eq = $"y = {mm}x {Sgn(bb)} {Math.Abs(bb)}";
            return McQ($"Which line has slope {mm} and y-intercept {bb}?", eq, new[] { $"y = {bb}x {Sgn(mm)} {Math.Abs(mm)}", $"y = {mm}x {(bb < 0 ? "+" : "−")} {Math.Abs(bb)}", $"y = {-mm}x {Sgn(bb)} {Math.Abs(bb)}" }, "y = (slope)x + (intercept).", $"{eq}.");
        }
        static Problem Quadratic(int t)
        {
            if (t == 1) { int k = Ri(2, 13); return InQ($"x² = {k * k}.  The positive solution?", k, "Which number squared gives this?", $"x = √{k * k} = {k}."); }
            if (t == 2) { int p = Ri(1, 7), q = Ri(1, 7); string corr = p == q ? $"x = {p} (double)" : $"x = {p} or x = {q}"; return McQ($"Solve:  x² − {p + q}x + {p * q} = 0", corr, new[] { $"x = {-p} or x = {-q}", $"x = {p + q} or x = {p * q}", $"x = {p + 1} or x = {(q - 1 == p + 1 ? q - 2 : q - 1)}" }, $"Two numbers that multiply to {p * q} and add to {p + q}.", $"(x − {p})(x − {q}) = 0 → x = {p}, {q}."); }
            int a = Pick(1, 2), h = Ri(-5, 5), b = -2 * a * h;
            return InQ($"The parabola y = {(a == 1 ? "" : a.ToString())}x² {Sgn(b)} {Math.Abs(b)}x + {Ri(1, 9)} has its vertex at what x-value?", h, "Vertex x = −b / 2a.", $"x = {-b}/(2·{a}) = {h}.");
        }
        static Problem Systems(int t)
        {
            if (t == 1) { int x = Ri(1, 8), d = Ri(1, 6), b = 2 * x + d; return InQ($"y = x + {d}  and  x + y = {b}.  x = ?", x, "Substitute the first rule into the second.", $"x + (x + {d}) = {b} → 2x = {2 * x} → x = {x}."); }
            if (t == 2) { int x = Ri(2, 9), y = Ri(1, 8); return InQ($"x + y = {x + y}  and  x − y = {x - y}.  x = ?", x, "Add the two equations — y cancels.", $"2x = {2 * x} → x = {x}."); }
            int xx = Ri(2, 9), yy = Ri(1, 9);
            return InQ($"{Ctx($"Two kelp-cakes and a shell cost {2 * xx + yy} lumins; one of each costs {xx + yy}.")}\nPrice of one kelp-cake?", xx, "Subtract the smaller purchase from the larger.", $"(2x + y) − (x + y) = x = {xx}.");
        }
        // ---------- Trig Temple
        static readonly int[][] TrigTriples = { new[] { 3, 4, 5 }, new[] { 5, 12, 13 }, new[] { 8, 15, 17 }, new[] { 7, 24, 25 } };
        static Problem RightTri(int t)
        {
            var T = Pick(TrigTriples);
            if (t == 1) { string which = Pick("sin", "cos", "tan"); var val = which == "sin" ? (T[0], T[2]) : which == "cos" ? (T[1], T[2]) : (T[0], T[1]); return FrQ($"{Ctx($"In a right triangle, angle A's opposite side is {T[0]}, adjacent is {T[1]}, hypotenuse is {T[2]}.")}\n{which}(A) = ?  {Ctx("(as a fraction)")}", val.Item1, val.Item2, "SOH-CAH-TOA.", $"{which}(A) = {FrStr(val.Item1, val.Item2)}."); }
            if (t == 2) { int k = Ri(2, 4); return InQ($"sin(θ) = {FrStr(T[0], T[2])} and the hypotenuse is {T[2] * k}. Length of the opposite side?", T[0] * k, "opposite = sin(θ) × hypotenuse.", $"{FrStr(T[0], T[2])} × {T[2] * k} = {T[0] * k}."); }
            var cases = new[] { ("tan(θ) = 1", 45), ("sin(θ) = 1/2", 30), ("cos(θ) = 1/2", 60), ("sin(θ) = √3/2", 60), ("cos(θ) = √2/2", 45), ("tan(θ) = √3", 60), ("sin(θ) = √2/2", 45), ("cos(θ) = √3/2", 30) };
            var c = Pick(cases);
            return McQ($"{c.Item1}, with θ acute.  θ = ?", $"{c.Item2}°", new[] { "30°", "45°", "60°", "90°" }.Where(x => x != c.Item2 + "°"), "These are the temple’s three sacred angles.", $"θ = {c.Item2}°.");
        }
        static Problem UnitCircle(int t)
        {
            var table = new Dictionary<int, (string s, string c)> { [0] = ("0", "1"), [30] = ("1/2", "√3/2"), [45] = ("√2/2", "√2/2"), [60] = ("√3/2", "1/2"), [90] = ("1", "0"), [180] = ("0", "−1"), [270] = ("−1", "0") };
            if (t == 1) { int deg = Pick(0, 30, 45, 60, 90, 180, 270); string fn = Pick("sin", "cos"); string v = fn == "sin" ? table[deg].s : table[deg].c; return McQ($"{fn}({deg}°) = ?", v, new[] { "0", "1/2", "√2/2", "√3/2", "1", "−1", "−1/2" }.Where(x => x != v), "Walk the circle: x is cosine, y is sine.", $"{fn}({deg}°) = {v}."); }
            if (t == 2) { var pairs = new[] { (30, "π/6"), (45, "π/4"), (60, "π/3"), (90, "π/2"), (120, "2π/3"), (180, "π"), (270, "3π/2"), (360, "2π") }; var p = Pick(pairs); return McQ($"Convert {p.Item1}° to radians.", p.Item2, pairs.Where(x => x.Item2 != p.Item2).Select(x => x.Item2), "Multiply by π/180.", $"{p.Item1}° × π/180 = {p.Item2}."); }
            var cases = new[] { ("sin(150°)", "1/2"), ("cos(120°)", "−1/2"), ("sin(210°)", "−1/2"), ("cos(135°)", "−√2/2"), ("sin(300°)", "−√3/2"), ("cos(240°)", "−1/2"), ("sin(135°)", "√2/2") };
            var c = Pick(cases);
            return McQ($"{c.Item1} = ?", c.Item2, new[] { "1/2", "−1/2", "√2/2", "−√2/2", "√3/2", "−√3/2" }.Where(x => x != c.Item2), "Find the reference angle, then the quadrant’s sign.", $"{c.Item1} = {c.Item2}.");
        }
        static Problem TrigSolve(int t)
        {
            if (t == 1) { var cases = new[] { ("sin(x) = 1/2", "30° and 150°"), ("cos(x) = 1/2", "60° and 300°"), ("sin(x) = √2/2", "45° and 135°"), ("tan(x) = 1", "45° and 225°"), ("cos(x) = −1/2", "120° and 240°") }; var c = Pick(cases); return McQ($"Solve on [0°, 360°):  {c.Item1}", c.Item2, cases.Where(x => x.Item2 != c.Item2).Select(x => x.Item2), "One angle per matching quadrant.", $"x = {c.Item2}."); }
            var T = Pick(TrigTriples.Take(3).ToArray());
            if (t == 2) return FrQ($"θ is acute and sin(θ) = {FrStr(T[0], T[2])}.  cos(θ) = ?  {Ctx("(as a fraction)")}", T[1], T[2], "sin² + cos² = 1 — or picture the right triangle.", $"cos(θ) = √(1 − {FrStr(T[0] * T[0], T[2] * T[2])}) = {FrStr(T[1], T[2])}.");
            return FrQ($"θ is acute, sin(θ) = {FrStr(T[0], T[2])}, cos(θ) = {FrStr(T[1], T[2])}.  sin(2θ) = ?  {Ctx("(as a fraction)")}", 2 * T[0] * T[1], T[2] * T[2], "sin(2θ) = 2 sin(θ) cos(θ).", $"2 × {FrStr(T[0], T[2])} × {FrStr(T[1], T[2])} = {FrStr(2 * T[0] * T[1], T[2] * T[2])}.");
        }
        // ---------- Chance Mire
        static Problem Probability(int t)
        {
            if (t == 1) { int r = Ri(2, 5), b = Ri(2, 5), g = Ri(1, 4); return FrQ($"{Ctx($"A witch's pouch holds {r} red, {b} blue, and {g} green bones.")}\nP(drawing a red bone) = ?  {Ctx("(as a fraction)")}", r, r + b + g, "Favorable over total.", $"{r} red out of {r + b + g} bones: {FrStr(r, r + b + g)}."); }
            if (t == 2) { var f = Pick(("rolling a 6 on a die", 1, 6), ("flipping heads", 1, 2), ("rolling an even number", 1, 2), ("rolling a 5 or 6", 1, 3)); var g2 = Pick(("then flipping heads", 1, 2), ("then rolling a 6", 1, 6), ("then rolling an odd number", 1, 2)); return FrQ($"P({f.Item1}, {g2.Item1}) = ?  {Ctx("(independent events; as a fraction)")}", f.Item2 * g2.Item2, f.Item3 * g2.Item3, "Independent events: multiply the probabilities.", $"{FrStr(f.Item2, f.Item3)} × {FrStr(g2.Item2, g2.Item3)} = {FrStr(f.Item2 * g2.Item2, f.Item3 * g2.Item3)}."); }
            int rr = Ri(3, 6), bb = Ri(2, 5), tot = rr + bb;
            return FrQ($"{Ctx($"A pouch holds {rr} red and {bb} blue bones. You draw two, without putting the first back.")}\nP(both red) = ?  {Ctx("(as a fraction)")}", rr * (rr - 1), tot * (tot - 1), "The second draw has one fewer red and one fewer total.", $"{FrStr(rr, tot)} × {FrStr(rr - 1, tot - 1)} = {FrStr(rr * (rr - 1), tot * (tot - 1))}.");
        }
        static long Fact(int k) => k <= 1 ? 1 : k * Fact(k - 1);
        static Problem Counting(int t)
        {
            if (t == 1) { int a = Ri(2, 5), b = Ri(2, 5), c = Ri(2, 4); return InQ($"A Mathfinder owns {a} cloaks, {b} lanterns, and {c} charms. How many different outfits?", a * b * c, "Multiply the choices at each step.", $"{a} × {b} × {c} = {a * b * c}."); }
            if (t == 2) { int n = Ri(4, 7), r = Pick(2, 3); long v = 1; for (int i = 0; i < r; i++) v *= (n - i); return InQ($"{n} witches; {r} distinct seats (first, second{(r == 3 ? ", third" : "")}). How many seatings?", v, $"Order matters: {n} choices, then {n - 1}…", $"{string.Join(" × ", Enumerable.Range(0, r).Select(i => n - i))} = {v}."); }
            int nn = Ri(5, 9), rr = Pick(2, 3); long vv = Fact(nn) / (Fact(rr) * Fact(nn - rr));
            return InQ($"Choose {rr} of {nn} witches for a circle (order doesn't matter). How many ways?", vv, "Count the ordered ways, then divide out the repeats.", $"C({nn},{rr}) = {nn}!/({rr}!·{nn - rr}!) = {vv}.");
        }
        static Problem Statistics(int t)
        {
            if (t == 1) { int m = Ri(4, 12), k = Ri(4, 5); var xs = new List<int>(); int s = 0; for (int i = 0; i < k - 1; i++) { int v = m + Ri(-3, 3); xs.Add(v); s += v; } xs.Add(m * k - s); return InQ($"Mean of {string.Join(", ", Shuffle(xs))} ?", m, "Add them all, divide by how many.", $"Sum = {m * k}, ÷ {k} = {m}."); }
            if (t == 2) { var xs = Enumerable.Range(0, 5).Select(_ => Ri(1, 30)).ToList(); var sorted = xs.OrderBy(v => v).ToList(); return InQ($"Median of {string.Join(", ", Shuffle(xs))} ?", sorted[2], "Sort them first; take the middle one.", $"Sorted: {string.Join(", ", sorted)} → middle is {sorted[2]}."); }
            int mm = Ri(6, 15); var ys = new List<int>(); int ss = 0; for (int i = 0; i < 4; i++) { int v = mm + Ri(-4, 4); ys.Add(v); ss += v; } int missing = mm * 5 - ss;
            return InQ($"{Ctx($"Five bone-casts have mean {mm}. Four of them are {string.Join(", ", ys)}.")}\nThe fifth cast?", missing, $"All five must total {mm} × 5 = {mm * 5}.", $"{mm * 5} − {ss} = {missing}.");
        }
        // ---------- Calculus Caldera
        static Problem Limits(int t)
        {
            if (t == 1) { int a = Ri(2, 6), b = Ri(1, 9), c = Ri(1, 5); return InQ($"lim<sub>x→{c}</sub> ({a}x + {b}) = ?", a * c + b, "A polynomial is continuous — just substitute.", $"{a}({c}) + {b} = {a * c + b}."); }
            if (t == 2) { int a = Ri(2, 7); return InQ($"lim<sub>x→{a}</sub> {Fr("x² − " + a * a, "x − " + a)} = ?", 2 * a, $"Factor the top: x² − {a * a} = (x−{a})(x+{a}).", $"Cancel (x − {a}) → limit of x + {a} = {2 * a}."); }
            int aa = Ri(2, 9), bb = Ri(2, 9);
            return FrQ($"lim<sub>x→∞</sub> {Fr(aa + "x² + x", bb + "x² − 5")} = ?  {Ctx("(fraction ok)")}", aa, bb, "At infinity only the leading terms matter.", $"Ratio of leading coefficients: {FrStr(aa, bb)}.");
        }
        static string Pow(string b, int n) => n == 1 ? b : $"{b}^{n}";
        static Problem Derivative(int t)
        {
            if (t == 1) { int a = Ri(2, 7), n = Ri(2, 5); return McQ($"d/dx of {a}x{Sup(n)} = ?", $"{a * n}{Pow("x", n - 1)}", new[] { $"{a}{Pow("x", n - 1)}", $"{a * n}x^{n}", $"{a * (n + 1)}x^{n + 1}" }, "Bring the power down, lower it by one.", $"{a}·{n}·x^{n - 1} = {a * n}{Pow("x", n - 1)}."); }
            if (t == 2) { int a = Ri(1, 4), b = Ri(2, 9), c = Ri(1, 9), k = Ri(1, 4); return InQ($"f(x) = {a}x² + {b}x + {c}.  f′({k}) = ?", 2 * a * k + b, $"f′(x) = {2 * a}x + {b}; substitute {k}.", $"{2 * a}({k}) + {b} = {2 * a * k + b}."); }
            int aa = Ri(2, 5), bb = Ri(1, 9);
            return McQ($"d/dx of ({aa}x + {bb})² = ?", $"{2 * aa}({aa}x + {bb})", new[] { $"2({aa}x + {bb})", $"{aa}({aa}x + {bb})", $"{2 * aa}x + {bb}" }, "Chain rule: outer derivative × inner derivative.", $"2({aa}x + {bb}) × {aa} = {2 * aa}({aa}x + {bb}).");
        }
        static Problem Integral(int t)
        {
            if (t == 1) { int a = Pick(2, 4, 6, 8); return McQ($"∫ {a}x dx = ?", $"{a / 2}x² + C", new[] { $"{a}x² + C", $"{a / 2}x + C", $"{2 * a}x² + C" }, "Raise the power by one, divide by the new power.", $"{a}x → {a}/2 · x² = {a / 2}x² + C."); }
            if (t == 2) { int a = Pick(2, 4), b = Ri(1, 6), k = Ri(1, 4); int v = a / 2 * k * k + b * k; return InQ($"∫<sub>0</sub><sup>{k}</sup> ({a}x + {b}) dx = ?", v, $"Antiderivative: {a / 2}x² + {b}x; evaluate at {k}.", $"{a / 2}({k})² + {b}({k}) = {v}."); }
            int kk = Ri(1, 4);
            return FrQ($"∫<sub>0</sub><sup>{kk}</sup> x² dx = ?  {Ctx("(fraction ok)")}", kk * kk * kk, 3, "Antiderivative of x² is x³/3.", $"{kk}³/3 = {FrStr(kk * kk * kk, 3)}.");
        }
    }
}
