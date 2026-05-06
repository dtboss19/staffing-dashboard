from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_ROOT / "staffing_analytics.db"

app = FastAPI(title="Staffing Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_query(sql_query: str, parameters: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(sql_query, parameters).fetchall()
    return [dict(row) for row in rows]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/filters")
def get_filters() -> dict[str, Any]:
    years = run_query(
        """
        SELECT DISTINCT year
        FROM monthly_neighborhood
        ORDER BY year
        """
    )
    neighborhoods = run_query(
        """
        SELECT DISTINCT neighborhood_number, neighborhood_name
        FROM monthly_neighborhood
        ORDER BY neighborhood_number
        """
    )
    categories = run_query(
        """
        SELECT DISTINCT category
        FROM fresh_test_category_long
        ORDER BY category
        """
    )
    return {
        "years": [row["year"] for row in years],
        "neighborhoods": neighborhoods,
        "categories": [row["category"] for row in categories],
    }


@app.get("/kpis")
def get_kpis(
    start_year: int = Query(2014),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
    category: str | None = Query(default=None),
) -> dict[str, Any]:
    monthly_filters = ["year BETWEEN ? AND ?"]
    monthly_params: list[Any] = [start_year, end_year]
    category_filters = ["m.year BETWEEN ? AND ?"]
    category_params: list[Any] = [start_year, end_year]
    category_exists_clause = ""
    category_exists_params: list[Any] = []

    if neighborhood_number is not None:
        monthly_filters.append("neighborhood_number = ?")
        monthly_params.append(neighborhood_number)
        category_filters.append("cm.neighborhood_number = ?")
        category_params.append(neighborhood_number)

    if category:
        category_exists_clause = """
            AND EXISTS (
                SELECT 1
                FROM fresh_test_category_long c_filter
                WHERE c_filter.year = cm.year
                    AND c_filter.month = cm.month
                    AND c_filter.NEIGHBORHOOD_NUMBER = cm.neighborhood_number
                    AND c_filter.category = ?
            )
        """
        category_exists_params.append(category)

    summary = run_query(
        f"""
        SELECT
            COUNT(*) AS records,
            AVG(actual_total_count) AS avg_actual_total_count,
            AVG(predicted_total_count) AS avg_predicted_total_count,
            AVG(staffing_strength_score_0_100) AS avg_staffing_strength_score,
            AVG(CASE
                WHEN actual_total_count > 0
                THEN ABS(actual_total_count - predicted_total_count) * 100.0 / actual_total_count
                ELSE NULL
            END) AS avg_ape_total_pct
        FROM monthly_neighborhood
        WHERE {" AND ".join(monthly_filters)}
        """,
        tuple(monthly_params),
    )

    category_wape = run_query(
        f"""
        WITH category_month AS (
            SELECT
                c.year,
                c.month,
                c.NEIGHBORHOOD_NUMBER AS neighborhood_number,
                SUM(ABS(c.actual_count - c.expected_count)) AS category_abs_error_sum,
                SUM(c.actual_count) AS category_actual_sum
            FROM fresh_test_category_long c
            GROUP BY c.year, c.month, c.NEIGHBORHOOD_NUMBER
        )
        SELECT
            SUM(cm.category_abs_error_sum) AS absolute_error_sum,
            SUM(cm.category_actual_sum) AS actual_sum,
            CASE
                WHEN SUM(cm.category_actual_sum) > 0
                THEN SUM(cm.category_abs_error_sum) * 100.0 / SUM(cm.category_actual_sum)
                ELSE NULL
            END AS category_wape_pct,
            CASE
                WHEN SUM(m.predicted_total_count) > 0
                THEN SUM(cm.category_abs_error_sum) * 100.0 / SUM(m.predicted_total_count)
                ELSE NULL
            END AS normalized_category_error_pct
        FROM category_month cm
        JOIN monthly_neighborhood m
            ON m.year = cm.year
            AND m.month = cm.month
            AND m.neighborhood_number = cm.neighborhood_number
        WHERE {" AND ".join(category_filters)}
        {category_exists_clause}
        """,
        tuple(category_params + category_exists_params),
    )

    combined = summary[0] if summary else {}
    combined.update(category_wape[0] if category_wape else {})
    return combined


@app.get("/neighborhood-summary")
def neighborhood_summary(
    start_year: int = Query(2014),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
    category: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    monthly_filters = ["year BETWEEN ? AND ?"]
    monthly_params: list[Any] = [start_year, end_year]
    category_filters = ["1=1"]
    category_params: list[Any] = []

    if neighborhood_number is not None:
        monthly_filters.append("neighborhood_number = ?")
        monthly_params.append(neighborhood_number)

    if category:
        category_filters.append("category = ?")
        category_params.append(category)

    return run_query(
        f"""
        WITH monthly_scope AS (
            SELECT *
            FROM monthly_neighborhood
            WHERE {" AND ".join(monthly_filters)}
        ),
        category_scope AS (
            SELECT
                year,
                month,
                NEIGHBORHOOD_NUMBER AS neighborhood_number,
                SUM(ABS(actual_count - expected_count)) AS category_abs_error_sum,
                SUM(actual_count) AS category_actual_sum
            FROM fresh_test_category_long
            WHERE {" AND ".join(category_filters)}
            GROUP BY year, month, NEIGHBORHOOD_NUMBER
        )
        SELECT
            m.neighborhood_number,
            m.neighborhood_name,
            AVG(m.actual_total_count) AS avg_actual_total_count,
            AVG(m.predicted_total_count) AS avg_predicted_total_count,
            AVG(m.staffing_strength_score_0_100) AS avg_staffing_score,
            AVG(CASE
                WHEN m.actual_total_count > 0
                THEN ABS(m.actual_total_count - m.predicted_total_count) * 100.0 / m.actual_total_count
                ELSE NULL
            END) AS avg_ape_total_pct,
            CASE
                WHEN SUM(cs.category_actual_sum) > 0
                THEN SUM(cs.category_abs_error_sum) * 100.0 / SUM(cs.category_actual_sum)
                ELSE NULL
            END AS category_wape_pct,
            CASE
                WHEN SUM(CASE WHEN cs.category_abs_error_sum IS NOT NULL THEN m.predicted_total_count ELSE 0 END) > 0
                THEN SUM(cs.category_abs_error_sum) * 100.0
                    / SUM(CASE WHEN cs.category_abs_error_sum IS NOT NULL THEN m.predicted_total_count ELSE 0 END)
                ELSE NULL
            END AS normalized_category_error_pct
        FROM monthly_scope m
        LEFT JOIN category_scope cs
            ON cs.year = m.year
            AND cs.month = m.month
            AND cs.neighborhood_number = m.neighborhood_number
        GROUP BY m.neighborhood_number, m.neighborhood_name
        ORDER BY m.neighborhood_number
        """,
        tuple(monthly_params + category_params),
    )


@app.get("/trend")
def trend(
    start_year: int = Query(2014),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
) -> list[dict[str, Any]]:
    filters = ["year BETWEEN ? AND ?"]
    parameters: list[Any] = [start_year, end_year]
    if neighborhood_number is not None:
        filters.append("neighborhood_number = ?")
        parameters.append(neighborhood_number)

    return run_query(
        f"""
        SELECT
            month_start,
            AVG(actual_total_count) AS actual_total_count,
            AVG(predicted_total_count) AS predicted_total_count,
            AVG(staffing_strength_score_0_100) AS staffing_strength_score_0_100
        FROM monthly_neighborhood
        WHERE {" AND ".join(filters)}
        GROUP BY month_start
        ORDER BY month_start
        """,
        tuple(parameters),
    )


@app.get("/extremes")
def extremes(
    start_year: int = Query(2014),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
) -> dict[str, Any]:
    filters = ["year BETWEEN ? AND ?"]
    parameters: list[Any] = [start_year, end_year]
    if neighborhood_number is not None:
        filters.append("neighborhood_number = ?")
        parameters.append(neighborhood_number)

    where_clause = " AND ".join(filters)
    highest = run_query(
        f"""
        SELECT
            month_start,
            neighborhood_number,
            neighborhood_name,
            staffing_strength_score_0_100
        FROM monthly_neighborhood
        WHERE {where_clause}
        ORDER BY staffing_strength_score_0_100 DESC
        LIMIT 1
        """,
        tuple(parameters),
    )
    lowest = run_query(
        f"""
        SELECT
            month_start,
            neighborhood_number,
            neighborhood_name,
            staffing_strength_score_0_100
        FROM monthly_neighborhood
        WHERE {where_clause}
        ORDER BY staffing_strength_score_0_100 ASC
        LIMIT 1
        """,
        tuple(parameters),
    )

    return {
        "highest_need_month": highest[0] if highest else None,
        "lowest_need_month": lowest[0] if lowest else None,
    }


@app.get("/forecast")
def forecast(
    start_year: int = Query(2026),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
) -> list[dict[str, Any]]:
    filters = ["year BETWEEN ? AND ?"]
    parameters: list[Any] = [start_year, end_year]

    if neighborhood_number is not None:
        filters.append("NEIGHBORHOOD_NUMBER = ?")
        parameters.append(neighborhood_number)

    return run_query(
        f"""
        SELECT
            year,
            month,
            month_start,
            NEIGHBORHOOD_NUMBER AS neighborhood_number,
            NEIGHBORHOOD_NAME AS neighborhood_name,
            Predict_Crime_Count AS predict_crime_count,
            Predict_Narcotic_Count AS predict_narcotic_count,
            Predict_Other_Count AS predict_other_count,
            Predict_ProactivePoliceVisits_Count AS predict_proactive_police_visits_count,
            Predict_PropertyDamage_Count AS predict_property_damage_count,
            Predict_PropertyTheft_Count AS predict_property_theft_count,
            Predict_ViolentPerson_Count AS predict_violent_person_count,
            Predict_Weapons_Count AS predict_weapons_count,
            staffing_strength_score_0_100,
            staffing_strength_level,
            forecast_method,
            year_weight_policy
        FROM forecast_2026_frozen
        WHERE {" AND ".join(filters)}
        ORDER BY year, month, NEIGHBORHOOD_NUMBER
        """,
        tuple(parameters),
    )


@app.get("/category-count-trend")
def category_count_trend(
    category: str = Query(...),
    start_year: int = Query(2014),
    end_year: int = Query(2026),
    neighborhood_number: int | None = Query(default=None),
) -> list[dict[str, Any]]:
    category_column_map = {
        "narcotics": ("actual_narcotics", "pred_narcotics"),
        "other": ("actual_other", "pred_other"),
        "proactive_police_visit": ("actual_proactive_police_visit", "pred_proactive_police_visit"),
        "property_damage": ("actual_property_damage", "pred_property_damage"),
        "property_theft": ("actual_property_theft", "pred_property_theft"),
        "violent_person": ("actual_violent_person", "pred_violent_person"),
        "weapons": ("actual_weapons", "pred_weapons"),
    }

    if category not in category_column_map:
        return []

    actual_column_name, predicted_column_name = category_column_map[category]
    filters = ["year BETWEEN ? AND ?"]
    parameters: list[Any] = [start_year, end_year]
    if neighborhood_number is not None:
        filters.append("neighborhood_number = ?")
        parameters.append(neighborhood_number)

    return run_query(
        f"""
        SELECT
            month_start,
            SUM({actual_column_name}) AS actual_count,
            SUM({predicted_column_name}) AS predicted_count
        FROM monthly_neighborhood
        WHERE {" AND ".join(filters)}
        GROUP BY month_start
        ORDER BY month_start
        """,
        tuple(parameters),
    )


@app.get("/map-hotspots")
def map_hotspots(
    year: int | None = Query(default=None),
) -> dict[str, Any]:
    if year is None:
        rows = run_query(
            """
            SELECT
                month_start,
                month,
                neighborhood_number,
                neighborhood_name,
                actual_total_count,
                predicted_total_count,
                staffing_strength_score_0_100
            FROM monthly_neighborhood
            ORDER BY year, month, neighborhood_number
            """
        )
    else:
        rows = run_query(
            """
            SELECT
                month_start,
                month,
                neighborhood_number,
                neighborhood_name,
                actual_total_count,
                predicted_total_count,
                staffing_strength_score_0_100
            FROM monthly_neighborhood
            WHERE year = ?
            ORDER BY month, neighborhood_number
            """,
            (year,),
        )
    months = sorted({row["month_start"] for row in rows})
    return {"year": year, "months": months, "rows": rows}
