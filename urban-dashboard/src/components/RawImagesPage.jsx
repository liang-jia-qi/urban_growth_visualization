import WorldMapFlat from "./WorldMapFlat";
import CityRawCompare from "./CityRawCompare";
import RawImagesGallery from "./RawImagesGallery";

const section = {
  padding: "48px 24px",
  borderBottom: "1px solid #eee",
};

export default function RawImagesPage() {
  return (
    <div style={{ overflowY: "auto", height: "100%", background: "#fff" }}>
      <section style={section}>
        <WorldMapFlat />
      </section>

      <section style={section}>
        <CityRawCompare />
      </section>

      <section style={{ ...section, borderBottom: "none", paddingBottom: 80 }}>
        <RawImagesGallery />
      </section>
    </div>
  );
}
