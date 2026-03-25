import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

try:
    import yfinance as yf
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"yfinance import failed: {exc}"}))
    sys.exit(1)


INDEX_ALIASES = {
    "VIX": "^VIX",
    "SPX": "^GSPC",
    "GSPC": "^GSPC",
    "NDX": "^NDX",
    "DJI": "^DJI",
    "RUT": "^RUT",
}

INTERVAL_BY_TIMEFRAME = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "60m",
    "4h": "60m",
    "1D": "1d",
    "1W": "1wk",
    "1M": "1mo",
}


def normalize_symbol(symbol: str) -> str:
    upper = symbol.upper()
    return INDEX_ALIASES.get(upper, upper)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def to_iso(ts: Any) -> str:
    if hasattr(ts, "to_pydatetime"):
        ts = ts.to_pydatetime()
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        else:
            ts = ts.astimezone(timezone.utc)
    return ts.isoformat().replace("+00:00", "Z")


def quote_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    symbol = normalize_symbol(str(payload.get("symbol", "")))
    if not symbol:
        raise ValueError("symbol is required")

    ticker = yf.Ticker(symbol)
    history = ticker.history(period="5d", interval="1d", auto_adjust=False, prepost=False)
    if history is None or history.empty:
        raise ValueError(f"No quote data for {symbol}")

    last_close = float(history["Close"].dropna().iloc[-1])
    prev_close = float(history["Close"].dropna().iloc[-2]) if len(history["Close"].dropna()) > 1 else last_close
    volume = int(float(history["Volume"].fillna(0).iloc[-1]))

    name = symbol
    try:
        info = ticker.get_info()
        if isinstance(info, dict):
            name = info.get("longName") or info.get("shortName") or symbol
    except Exception:
        name = symbol

    change = last_close - prev_close
    change_percent = 0 if prev_close == 0 else (change / prev_close) * 100

    return {
        "symbol": symbol,
        "companyName": name,
        "price": last_close,
        "change": change,
        "changePercent": change_percent,
        "volume": volume,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def ohlcv_action(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    symbol = normalize_symbol(str(payload.get("symbol", "")))
    timeframe = str(payload.get("timeframe", "1D"))
    from_iso = str(payload.get("from", ""))
    to_iso_value = str(payload.get("to", ""))
    if not symbol:
        raise ValueError("symbol is required")
    if not from_iso or not to_iso_value:
        raise ValueError("from and to are required")

    start = parse_iso(from_iso)
    end = parse_iso(to_iso_value)
    interval = INTERVAL_BY_TIMEFRAME.get(timeframe, "1d")
    ticker = yf.Ticker(symbol)

    history = ticker.history(
        start=start,
        end=end + timedelta(days=1),
        interval=interval,
        auto_adjust=False,
        prepost=False,
    )
    if history is None or history.empty:
        return []

    rows: List[Dict[str, Any]] = []
    for idx, row in history.iterrows():
        close = row.get("Close")
        open_price = row.get("Open")
        high = row.get("High")
        low = row.get("Low")
        if close is None or open_price is None or high is None or low is None:
            continue
        if any(str(v) == "nan" for v in [open_price, high, low, close]):
            continue
        rows.append(
            {
                "time": to_iso(idx),
                "open": float(open_price),
                "high": float(high),
                "low": float(low),
                "close": float(close),
                "volume": int(float(row.get("Volume") or 0)),
            }
        )
    return rows


def search_action(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    query = str(payload.get("query", "")).strip()
    if not query:
        return []

    quotes: List[Dict[str, Any]] = []
    try:
        searcher = yf.Search(query=query, max_results=10, news_count=0)
        raw = getattr(searcher, "quotes", None) or []
        for item in raw[:10]:
            symbol = str(item.get("symbol", "")).upper()
            if not symbol:
                continue
            quotes.append(
                {
                    "symbol": symbol,
                    "name": item.get("shortname") or item.get("longname") or symbol,
                    "exchange": item.get("exchange"),
                }
            )
    except Exception:
        return []

    return quotes


def market_status_action(_: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    day = now.weekday()  # Mon=0, Sun=6
    minutes = now.hour * 60 + now.minute
    open_min = 13 * 60 + 30
    close_min = 20 * 60
    is_weekday = 0 <= day <= 4
    is_open = is_weekday and open_min <= minutes <= close_min
    if not is_weekday:
        session = "CLOSED"
    elif is_open:
        session = "OPEN"
    elif minutes < open_min:
        session = "PRE"
    else:
        session = "AFTER"
    return {"isOpen": is_open, "session": session}


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Missing action"}))
        return

    action = sys.argv[1]
    payload: Dict[str, Any] = {}
    if len(sys.argv) > 2:
        payload = json.loads(sys.argv[2])

    handlers = {
        "quote": quote_action,
        "ohlcv": ohlcv_action,
        "search": search_action,
        "market_status": market_status_action,
    }

    if action not in handlers:
        print(json.dumps({"ok": False, "error": f"Unknown action: {action}"}))
        return

    try:
        data = handlers[action](payload)
        print(json.dumps({"ok": True, "data": data}, default=str))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))


if __name__ == "__main__":
    main()
