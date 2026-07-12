"""
UPSC LoG — Daily Rankings PDF Generator
-----------------------------------------
Pulls today's rows from your Google Sheet (via its CSV export link) and
builds a clean, professional-looking ranking PDF.

SETUP (one-time):
1. Open your Google Sheet -> File -> Share -> Publish to web
   -> select your sheet -> format: CSV -> Publish.
   Copy the URL it gives you and paste it into SHEET_CSV_URL below.

   (If you'd rather not "publish", you can instead use:
     https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
   as long as sharing is set to "Anyone with the link can view".)

2. Run:  python generate_rankings_pdf.py
   -> creates "UPSC_LoG_Daily_Rankings_<date>.pdf" in the same folder.

Your sheet is expected to have these columns (in this order), which is what
the Apps Script doPost() in your website is already writing:
   Timestamp | Name | Marks | Correct | Incorrect | Unattempted | Test Code
"""

import pandas as pd
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas as pdfcanvas

# ----------------------------------------------------------------------
# CONFIG — edit these two lines
# ----------------------------------------------------------------------
SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQV47aqy1-lIG6JJMsJYTfYFw_ABktsPNefweFWOJWQrJoMRkAfnriVYRo8ohyAwhrBwbD2QFttVR_x/pub?gid=0&single=true&output=csv"

# Leave as None to use today's date automatically, or set manually e.g. "2026-07-08"
TARGET_DATE = None
# ----------------------------------------------------------------------

NAVY = colors.HexColor("#1B3A5C")
NAVY_DEEP = colors.HexColor("#12283F")
GOLD = colors.HexColor("#B8862E")
GOLD_SOFT = colors.HexColor("#EFDFB8")
INK = colors.HexColor("#1D2A35")
INK_SOFT = colors.HexColor("#5B6873")
ROW_ALT = colors.HexColor("#F3F4F1")
RULE = colors.HexColor("#D8DCD6")
PAPER = colors.white


def load_today_rankings():
    expected_cols = ["Timestamp", "Name", "Marks", "Correct", "Incorrect", "Unattempted", "Test Code"]

    try:
        df = pd.read_csv(SHEET_CSV_URL, on_bad_lines="warn", engine="python")
    except TypeError:
        df = pd.read_csv(SHEET_CSV_URL, error_bad_lines=False, engine="python")

    df.columns = [c.strip() for c in df.columns]

    # If the sheet has no header row, the first data row gets mistaken for
    # headers — detect that (columns won't match expected names) and re-read
    # the CSV telling pandas there is no header, using our own column names.
    if not set(expected_cols).issubset(set(df.columns)):
        try:
            df = pd.read_csv(
                SHEET_CSV_URL, header=None, names=expected_cols,
                on_bad_lines="warn", engine="python"
            )
        except TypeError:
            df = pd.read_csv(
                SHEET_CSV_URL, header=None, names=expected_cols,
                error_bad_lines=False, engine="python"
            )

    # Google Sheets typically exports timestamps like "7/8/2026 10:09:37".
    # Try that exact format first (fast, no warning); fall back to flexible
    # parsing for any rows that don't match (e.g. different locale/format).
    raw_timestamp = df["Timestamp"].astype(str)
    df["Timestamp"] = pd.to_datetime(
        raw_timestamp, format="%m/%d/%Y %H:%M:%S", errors="coerce"
    )
    still_missing = df["Timestamp"].isna()
    if still_missing.any():
        df.loc[still_missing, "Timestamp"] = pd.to_datetime(
            raw_timestamp[still_missing], errors="coerce"
        )
    missing_timestamp = df["Timestamp"].isna().sum()
    df = df.dropna(subset=["Timestamp"])

    target = TARGET_DATE or datetime.now().strftime("%Y-%m-%d")
    df["DateOnly"] = df["Timestamp"].dt.strftime("%Y-%m-%d")
    today_df = df[df["DateOnly"] == target].copy()

    if today_df.empty:
        raise SystemExit(f"No submissions found for {target}. Nothing to generate.")

    # --- Clean up missing/blank values instead of letting "nan" leak into the PDF ---
    today_df["Marks"] = pd.to_numeric(today_df["Marks"], errors="coerce")
    missing_marks = today_df["Marks"].isna().sum()
    today_df = today_df.dropna(subset=["Marks"])  # can't rank without a mark

    today_df["Name"] = today_df["Name"].fillna("").astype(str).str.strip()
    missing_name = (today_df["Name"] == "").sum()
    today_df.loc[today_df["Name"] == "", "Name"] = "Unnamed"

    today_df["Test Code"] = today_df["Test Code"].fillna("").astype(str).str.strip()
    missing_testcode = (today_df["Test Code"] == "").sum()
    today_df.loc[today_df["Test Code"] == "", "Test Code"] = "—"

    if today_df.empty:
        raise SystemExit(f"All rows for {target} were missing valid marks — nothing to rank.")

    if missing_timestamp or missing_marks or missing_name or missing_testcode:
        print("⚠ Data quality notice:")
        if missing_timestamp:
            print(f"  - {missing_timestamp} row(s) had an unreadable timestamp and were excluded entirely.")
        if missing_marks:
            print(f"  - {missing_marks} row(s) had no valid marks and were excluded from ranking.")
        if missing_name:
            print(f"  - {missing_name} row(s) had a blank name — shown as 'Unnamed'.")
        if missing_testcode:
            print(f"  - {missing_testcode} row(s) had a blank test code — shown as '—'.")
        print()

    today_df = today_df.sort_values("Marks", ascending=False).reset_index(drop=True)
    today_df.insert(0, "Rank", today_df.index + 1)

    pretty_date = datetime.strptime(target, "%Y-%m-%d").strftime("%d %B %Y")
    return today_df, pretty_date


def draw_header_footer(c: pdfcanvas.Canvas, doc):
    width, height = A4

    # top navy band
    c.setFillColor(NAVY_DEEP)
    c.rect(0, height - 26 * mm, width, 26 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, height - 26 * mm, width, 4, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(20 * mm, height - 14 * mm, "UPSC LoG")
    c.setFont("Helvetica", 10.5)
    c.setFillColor(GOLD_SOFT)
    c.drawString(20 * mm, height - 20 * mm, "Prelims Booster Daily Rankings")

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.white)
    c.drawRightString(width - 20 * mm, height - 14 * mm, doc.pretty_date)
    c.setFillColor(GOLD_SOFT)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 20 * mm, height - 20 * mm, "t.me/upsclog")

    # footer
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    c.setFont("Helvetica", 8)
    c.setFillColor(INK_SOFT)
    c.drawString(20 * mm, 9 * mm, "UPSC LoG — Prelims Booster")
    c.drawRightString(width - 20 * mm, 9 * mm, f"Page {doc.page}")


def build_pdf(df, pretty_date, out_path):
    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        topMargin=34 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )
    doc.pretty_date = pretty_date

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=18, textColor=NAVY, spaceAfter=2, alignment=TA_LEFT,
    )
    sub_style = ParagraphStyle(
        "SubStyle", parent=styles["Normal"], fontName="Helvetica",
        fontSize=10, textColor=INK_SOFT, spaceAfter=14,
    )
    cell_style = ParagraphStyle(
        "Cell", parent=styles["Normal"], fontName="Helvetica",
        fontSize=9.5, textColor=INK, alignment=TA_LEFT, leading=12,
    )
    cell_center = ParagraphStyle(
        "CellCenter", parent=cell_style, alignment=TA_CENTER,
    )
    header_style = ParagraphStyle(
        "Header", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=10, textColor=colors.white, alignment=TA_CENTER,
    )

    story = []
    story.append(Paragraph("Daily Rankings", title_style))
    story.append(Paragraph(
        f"Results for all tests attempted on {pretty_date} · "
        f"{len(df)} participant(s) ranked by marks scored",
        sub_style
    ))

    footnote_style = ParagraphStyle(
        "Footnote", parent=styles["Normal"], fontName="Helvetica-Oblique",
        fontSize=8.5, textColor=INK_SOFT,
    )
    story.append(Paragraph(
        "Rankings are generated from live submissions recorded on the UPSC LoG "
        "Prelims Booster platform. In case of a tie in marks, entries are listed "
        "in order of submission.", footnote_style
    ))
    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceAfter=12))

    header_row = [
        Paragraph("Rank", header_style),
        Paragraph("Name", header_style),
        Paragraph("Test Code", header_style),
        Paragraph("Marks[/50]", header_style),
        Paragraph("Date of Test", header_style),
    ]
    table_data = [header_row]

    for _, row in df.iterrows():
        rank = int(row["Rank"])
        rank_label = f"#{rank}"
        if rank == 1:
            rank_label = "🥇 1"
        elif rank == 2:
            rank_label = "🥈 2"
        elif rank == 3:
            rank_label = "🥉 3"

        # Format this row's actual submission time, e.g. "7:16 PM"
        ts = row.get("Timestamp")
        if pd.notna(ts):
            time_str = pd.to_datetime(ts).strftime("%I:%M %p").lstrip("0")
        else:
            time_str = ""
        date_time_label = f"{pretty_date}<br/><font size=8 color='#5B6873'>{time_str}</font>" if time_str else pretty_date

        table_data.append([
            Paragraph(rank_label, cell_center),
            Paragraph(str(row.get("Name", "")), cell_style),
            Paragraph(str(row.get("Test Code", "")), cell_center),
            Paragraph(f"{row['Marks']:.2f}", cell_center),
            Paragraph(date_time_label, cell_center),
        ])

    col_widths = [22 * mm, 50 * mm, 38 * mm, 25 * mm, 35 * mm]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 9),

        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),

        ("GRID", (0, 0), (-1, -1), 0.6, RULE),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, GOLD),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]

    for i in range(1, len(table_data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
        else:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), PAPER))

    for i in range(1, min(4, len(table_data))):
        style_cmds.append(("BACKGROUND", (0, i), (0, i), GOLD_SOFT))
        style_cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))

    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    

    doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)


if __name__ == "__main__":
    df, pretty_date = load_today_rankings()
    out_file = f"UPSC_LoG_Daily_Rankings_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    build_pdf(df, pretty_date, out_file)
    print(f"Done — saved as {out_file}")