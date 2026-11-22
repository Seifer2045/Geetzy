"""Public catalogue: categories and templates. A template shows up here once it is active AND published,
under its category — so adding a template in the admin is all it takes for the app to list it."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import db, one
from ..schemas import Category, OutputType, Occasion, Template, TemplateStyle
from .common import TEMPLATE_SELECT, to_template

router = APIRouter()


@router.get("/")
def root():
    return {"name": "Geetzy API", "health": "/health", "docs": "/docs"}


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/templates", response_model=list[Template], response_model_by_alias=True)
def list_templates(
    occasion: Optional[Occasion] = None, style: Optional[TemplateStyle] = None, q: Optional[str] = None,
    category: Optional[str] = None, output_type: Optional[OutputType] = Query(default=None, alias="outputType"),
    limit: int = Query(default=100, ge=1, le=200),
):
    query = db().table("templates").select(TEMPLATE_SELECT).eq("is_active", True).eq("status", "published") \
        .order("sort_order").limit(limit)
    if occasion:
        query = query.eq("occasion", occasion)
    if style:
        query = query.eq("style", style)
    if output_type:
        query = query.eq("output_type", output_type)
    if category:
        cat = one(db().table("categories").select("id").eq("slug", category).eq("is_active", True).execute())
        if not cat:
            return []
        query = query.eq("category_id", cat["id"])
    rows = query.execute().data
    ql = (q or "").strip().lower()
    return [to_template(r) for r in rows
            if not ql or ql in r["name"].lower() or any(ql in tag.lower() for tag in r["tags"])]


@router.get("/categories", response_model=list[Category], response_model_by_alias=True)
def list_categories(output_type: Optional[OutputType] = Query(default=None, alias="outputType")):
    """Active categories in the order the admin dragged them. Drives the chips on Home / Explore."""
    query = db().table("categories").select("*").eq("is_active", True).order("sort_order")
    if output_type:
        query = query.eq("output_type", output_type)
    return [
        Category(id=r["id"], slug=r["slug"], name=r["name"], emoji=r["emoji"],
                 colors=(r["color_from"], r["color_to"]), output_type=r["output_type"])
        for r in query.execute().data
    ]


@router.get("/templates/{tid}", response_model=Template, response_model_by_alias=True)
def get_template(tid: str):
    row = one(db().table("templates").select(TEMPLATE_SELECT).eq("id", tid).eq("is_active", True).eq("status", "published").execute())
    if not row:
        raise HTTPException(404, f"Template {tid} not found")
    return to_template(row)
