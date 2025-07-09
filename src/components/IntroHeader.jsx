import React from "react";
import { useTranslation } from "react-i18next";

export default function IntroHeader({ onFileChange }) {
  const { t } = useTranslation();

  // 줄바꿈 지원
  const formatMultiLine = (str) =>
    str.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));

  return (
    <div style={{ padding: "2rem 2rem 0 2rem", borderBottom: "1px solid #ddd", marginBottom: 24 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: 8 }}>
        {t("WELCOME")}
      </h1>
      <div style={{ color: "#555", marginBottom: 8 }}>
        {t("TOOL_DESC")}
        <ul>
          <li>
            <b>{t("WARNING")}</b> : {t("FIRST_ROW_HEADER")}
          </li>
          <li>
            <b>.xlsx</b> : {t("XLSX")}
          </li>
          <li>
            <b>.xls</b> : {t("XLS")}
          </li>
          <li>
            <b>.csv</b> : {t("CSV")}
          </li>
        </ul>
      </div>
      <img
        src="/joinilo/banner.png"
        alt="배너"
        style={{
          width: "100%",
          maxWidth: 700,
          height: "auto",
          maxHeight: 300,
          borderRadius: 16,
          margin: "18px 0",
          objectFit: "contain",
        }}
      />
      <div style={{ display: "flex", maxWidth: 700 }}>
        <div style={{ width: "50%", paddingRight: 32 }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>{t("WHY_SPECIAL")}</div>
          <ul style={{ color: "#555", margin: 0, padding: 0 }}>
            <li>{t("DIRECT_MERGE")}</li>
            <li>{t("SEARCH")}</li>
            <li>{t("EASY_SAVE")}</li>
            <li>{t("NO_LOGIN")}</li>
            <li>{t("SIMPLE_UI")}</li>
            <li>{t("GROUP_STATS")}</li>
          </ul>
        </div>
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <label
            style={{
              border: "2px dashed #bbb",
              borderRadius: 12,
              padding: 36,
              width: "100%",
              background: "#f8fafc",
              cursor: "pointer",
              minHeight: 150,
              textAlign: "center",
            }}
            onDrop={(e) => {
              e.preventDefault();
              onFileChange && onFileChange({ target: { files: e.dataTransfer.files } });
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <span style={{ fontWeight: 500, color: "#666" }}>
              {formatMultiLine(t("DRAG_OR_UPLOAD"))}
            </span>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
            <br />
            <button
              style={{
                marginTop: 18,
                padding: "8px 20px",
                background: "#2563eb",
                color: "white",
                borderRadius: 8,
                border: "none",
                fontWeight: "bold",
                fontSize: 16,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.target.previousSibling.previousSibling.click();
              }}
              type="button"
            >
              {t("UPLOAD")}
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}
