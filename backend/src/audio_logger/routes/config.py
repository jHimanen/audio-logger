from fastapi import APIRouter, Request

router = APIRouter(prefix="/api")


@router.get("/config")
def get_config(request: Request) -> dict[str, str]:
    return {"locale": request.app.state.settings.app_locale}
