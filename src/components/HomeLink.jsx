export default function HomeLink() {
  return (
    <a href="/" aria-label="Back to Pressmark Studio home" style={{ position: "fixed", top: 16, left: 16, zIndex: 300, padding: "0.65rem 0.85rem", border: "1px solid rgba(170,125,72,.38)", borderRadius: 6, background: "rgba(255,255,255,.96)", boxShadow: "0 6px 20px rgba(2,8,20,.12)", color: "#020814", fontFamily: "Inter, Helvetica Neue, Arial, sans-serif", fontSize: "0.75rem", fontWeight: 800, lineHeight: 1, textDecoration: "none" }}>
      ← Home
    </a>
  );
}
