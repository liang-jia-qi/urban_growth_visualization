import { useStore } from "../store";
import { dataUrl } from "../dataUrl";

export default function RawImagesGallery() {
  const { cities, selectCity } = useStore();

  if (!cities || cities.length === 0) return null;

  const sorted = [...cities].sort((a, b) => a.Name.localeCompare(b.Name));

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <h3 style={{ textAlign: "center" }}>All Cities — 2016 vs 2023</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 4,
        }}
      >
        {sorted.map(city => (
          <div
            key={city.Name}
            onClick={() => selectCity(city)}
            style={{ cursor: "pointer", textAlign: "center" }}
            title={city.Name}
          >
            <div style={{ display: "flex", gap: 2 }}>
              <img
                src={dataUrl(`raw_images/${city.Name}_2016.png`)}
                alt={`${city.Name} 2016`}
                style={{ width: "50%", background: "#000", aspectRatio: "1 / 1", objectFit: "cover" }}
                loading="lazy"
              />
              <img
                src={dataUrl(`raw_images/${city.Name}_2023.png`)}
                alt={`${city.Name} 2023`}
                style={{ width: "50%", background: "#000", aspectRatio: "1 / 1", objectFit: "cover" }}
                loading="lazy"
              />
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {city.Name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
