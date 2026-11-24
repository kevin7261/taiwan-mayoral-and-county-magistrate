"""
臺灣縣市長編年表的資料（原本是 K30DayMapChallenge-2026 Day 28）：歷任民選縣市長的黨籍，按在任時間加權，算出每個縣市（現在的 22 縣市）各黨執政了幾成。

資料：中文維基百科每個縣市的「XX縣縣長／XX市市長」條目，只取民選的那幾張表
（「實施地方自治後」「公民直選」「民選縣長」「直轄市時期」等）；官派、院轄市時期（臺北 1967–1994、高雄 1979–1994）、
代理、暫代不算進比例（編年表照樣列出，標 acting）。條目快取在 data/raw/wiki/（不進 git），重抓刪掉即可。

計算：
- 黨籍用當選時的（維基寫「無黨籍 → 中國國民黨」就算無黨籍）
- 每一天看這個縣市有沒有民選首長在任，有就記他的黨；沒有（官派、代理、出缺）那天不算
- 兩個縣市合併的（臺中、臺南、高雄 2010 年縣市合併）：合併前每一天把縣、市兩邊各自的黨平均（各算一半），
  只有一邊是民選的那天就只算那一邊；新北（臺北縣）、桃園（桃園縣）升格前後當成同一個
- 各黨比例 ＝ 各黨在任天數 ÷ 全部算進來的天數

期間：全部（第一屆起）、1990 年後、1996 年後、1981–1990、1991–2000、2001–2010、2011–2026（只算期間內的天數）

輸出 src/data/mayor-history.json：{ asOf, periods: { 期間: [起, 迄) }, parties, counties: { 縣市: { from, periods: { 期間: { days, share: {黨: 比例} } }, terms: [...] } },
  old: { 合併前的舊縣、舊市（臺中縣、臺中市（合併前）…）: 同上，只算自己那一邊 } }
"""
import json, re, time, urllib.parse, urllib.request
from datetime import date, timedelta
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent.parent
RAW = ROOT / 'data/raw/wiki'
AS_OF = date(2026, 11, 1)  # 「現任」算到這天
# 期間 → [起, 迄)：全部、1990 年後、1996 年後，和四個十年（年份含頭含尾，例如 1981–1990 ＝ 1981-01-01 到 1991-01-01 前一天）
PERIODS = {
    'all': (None, AS_OF), '1990': (date(1990, 1, 1), AS_OF), '1996': (date(1996, 1, 1), AS_OF),
    '1981-1990': (date(1981, 1, 1), date(1991, 1, 1)), '1991-2000': (date(1991, 1, 1), date(2001, 1, 1)),
    '2001-2010': (date(2001, 1, 1), date(2011, 1, 1)), '2011-2026': (date(2011, 1, 1), AS_OF),
}
UA = 'taiwan-mayoral-and-county-magistrate/1.0 (https://github.com/szfftz/taiwan-mayoral-and-county-magistrate)'

# 現在的縣市 → [(維基條目, 要用的表格段落標題)]；同一縣市有兩個條目、同時期都有民選首長的，就是合併前的兩邊
COUNTIES = {
    '臺北市': [('臺北市市長', ['實施地方自治後', '直轄市時期'])],
    '新北市': [('臺北縣縣長', ['實施地方自治後']), ('新北市市長', ['歷任市長'])],
    '桃園市': [('桃園縣縣長', ['民選']), ('桃園市市長', ['歷任市長'])],
    '臺中市': [('臺中市市長', ['實施地方自治後', '直轄市時期']), ('臺中縣縣長', ['實施地方自治後'])],
    '臺南市': [('臺南市市長', ['實施地方自治後', '直轄市時期']), ('臺南縣縣長', ['實施地方自治後'])],
    '高雄市': [('高雄市市長', ['實施地方自治後', '直轄市時期', '直轄市時期（合併高雄縣後）']), ('高雄縣縣長', ['公民直選'])],
    '基隆市': [('基隆市市長', ['公民直選'])],
    '新竹市': [('新竹市市長', ['省轄市時期（1982年至今）'])],
    '新竹縣': [('新竹縣縣長', ['民選縣長'])],
    '苗栗縣': [('苗栗縣縣長', ['民選縣長'])],
    '彰化縣': [('彰化縣縣長', ['公民直選'])],
    '南投縣': [('南投縣縣長', ['公民直選'])],
    '雲林縣': [('雲林縣縣長', ['公民直選'])],
    '嘉義市': [('嘉義市市長', ['省轄市時期（1982年至今）'])],
    '嘉義縣': [('嘉義縣縣長', ['公民直選'])],
    '屏東縣': [('屏東縣縣長', ['歷任縣長'])],
    '宜蘭縣': [('宜蘭縣縣長', ['民選縣長'])],
    '花蓮縣': [('花蓮縣縣長', ['花蓮縣縣長（地方自治後）'])],
    '臺東縣': [('臺東縣縣長', ['公民直選'])],
    '澎湖縣': [('澎湖縣縣長', ['公民直選'])],
    '金門縣': [('金門縣縣長', ['民選縣長'])],
    '連江縣': [('連江縣縣長 (中華民國)', ['民選縣長'])],
}
# 合併前兩邊的名字（條目 → 那一邊叫什麼），tooltip 用
UNIT = {'臺北縣縣長': '臺北縣', '新北市市長': '新北市', '桃園縣縣長': '桃園縣', '桃園市市長': '桃園市', '臺中縣縣長': '臺中縣', '臺南縣縣長': '臺南縣', '高雄縣縣長': '高雄縣'}
# 黨 → 分類
PARTIES = [
    ('kmt', '國民黨', ['中國國民黨']),
    ('dpp', '民進黨', ['民主進步黨']),
    ('tpp', '民眾黨', ['台灣民眾黨']),
    ('ind', '無黨籍', ['無黨籍']),
    ('pfp', '親民黨', ['親民黨']),
    ('np', '新黨', ['新黨']),
    ('csdp', '民社黨', ['中國民主社會黨']),
    ('cyp', '青年黨', ['中國青年黨']),
    ('nnc', '新國家連線', ['新國家連線']),
]
PARTY_OF = {name: k for k, _, names in PARTIES for name in names}
# 2010-12-25 縣市合併：臺中、臺南、高雄；舊底圖上的舊市叫「臺中市（合併前）」，跟合併後的臺中市分開
MERGED = ('臺中市', '臺南市', '高雄市')
MERGE_DAY = date(2010, 12, 25)
OLD_KEY = {c: f'{c}（合併前）' for c in MERGED}


def fetch(page):
    f = RAW / f'{page}.json'
    if not f.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'text', 'format': 'json', 'formatversion': 2, 'redirects': 1, 'variant': 'zh-tw'})
        req = urllib.request.Request(f'https://zh.wikipedia.org/w/api.php?{q}', headers={'User-Agent': UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        time.sleep(0.5)
    return json.loads(f.read_text())['parse']['text']


def clean(c):
    for s in c.select('sup, style'):
        s.decompose()
    return re.sub(r'\s+', ' ', c.get_text(' ', strip=True)).strip()


# 表格攤平成格子（rowspan、colspan 展開），合併儲存格的連任列才拿得到姓名、黨籍
def grid(t):
    out, spans = [], {}
    for tr in t.select('tr'):
        row, col, cells = [], 0, iter(tr.find_all(['td', 'th'], recursive=False))
        while True:
            if spans.get(col, (0,))[0] > 0:
                n, v = spans[col]
                row.append(v)
                spans[col] = (n - 1, v)
                col += 1
                continue
            c = next(cells, None)
            if c is None:
                break
            v = clean(c)
            rs = int(re.sub(r'\D', '', c.get('rowspan', '1')) or 1)
            cs = int(re.sub(r'\D', '', c.get('colspan', '1')) or 1)
            for _ in range(cs):
                row.append(v)
                if rs > 1:
                    spans[col] = (rs - 1, v)
                col += 1
        out.append(row)
    return out


DATE = re.compile(r'(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?')


def day(s):
    if '現任' in s:
        return AS_OF
    m = DATE.search(s)
    return m and date(int(m[1]), int(m[2]), int(m[3] or 1))  # 只寫到月的算 1 日


# 不是民選的表（編年表照樣畫、加註記，不算進比例）：條目裡的小標題 → 註記；1945 年以前（日治）的不讀
NOT_ELECTED = {
    '實施地方自治前': '官派', '院轄市時期': '官派', '官派縣長': '官派', '省政府指派': '官派', '政府官派': '官派',
    '省署／省政府指派': '官派', '臺灣省政府指派': '官派', '縣長（官派）': '官派', '歷任縣長': '官派',  # 雲林的「歷任縣長」是 1950 年官派代理（屏東的同名表是民選，先比對民選）
    '花蓮縣縣長（地方自治前）': '官派', '縣轄市時期': '縣轄市', '縣轄市時期（1950年～1982年）': '縣轄市',
    '金門軍管區行政長官': '戰地政務', '戰地政務委員': '戰地政務',
}
SINCE = date(1945, 8, 15)
counted = lambda t: not t.get('acting') and not t.get('note')  # 算進比例的：民選、不是代理


# 連結文字 → 維基條目名（紅字＝沒有條目的不要）
def linked(el):
    return {a.get_text(strip=True): a['title'] for a in el.select('a[title]') if 'new' not in a.get('class', []) and a.get('href', '').startswith(('/wiki/', '/zh'))}


def terms(page, heads):
    soup = BeautifulSoup(fetch(page), 'lxml')
    page_links = linked(soup)
    out = []
    for t in soup.select('table.wikitable'):
        h = t.find_previous(['h2', 'h3', 'h4'])
        g = grid(t)
        if not h or not g:
            continue
        ht = h.get_text(strip=True)
        note = None if ht in heads else NOT_ELECTED.get(ht)
        if ht not in heads and not note:
            continue
        hdr = g[0]
        if not note and '黨籍' not in hdr:
            continue
        # 編年表點格子開這個人的維基條目
        links = {**page_links, **linked(t)}  # 先用這張表裡的連結，表裡沒連的用整頁的（條目下面的歷任首長導覽框）
        # 日期：兩欄（就任、卸任）或一欄「A－B」
        ti = [i for i, x in enumerate(hdr) if x.startswith(('在任時間', '任期', '就任', '卸任', '任職'))]
        pi = hdr.index('黨籍') if '黨籍' in hdr else None
        ki = next((hdr.index(k) for k in ('任次', '屆次') if k in hdr), None)
        ni = next(i for i, x in enumerate(hdr) if x.startswith('姓名'))
        for r in g[1:]:
            if len(r) <= max(ti[-1], pi or 0, ni):
                continue
            acting = ki is not None and bool(re.search(r'代理|暫代|兼代|署理', r[ki]))
            if len(ti) > 1:
                a, b = day(r[ti[0]]), day(r[ti[1]]) or (acting and r[ti[1]] == '代理' and AS_OF)  # 澎湖林皆興的卸任欄寫「代理」＝現任
            else:
                ab = re.split(r'[－–—~～]', r[ti[0]])
                a, b = day(ab[0]), len(ab) > 1 and day(ab[1])
            if not a or not b or (note and b <= SINCE):
                continue
            party = (r[pi] if pi is not None else '').split('→')[0].strip()  # 當選時的黨籍
            if party not in PARTY_OF and (party or not note):
                raise SystemExit(f'{page}：不認得的黨籍「{party}」')
            name = re.sub(r'（.*?）|\(.*?\)', '', r[ni]).strip()
            out.append({'name': name, 'party': PARTY_OF.get(party), 'partyName': r[pi] if pi is not None and r[pi] else '黨籍不詳', 'start': a, 'end': b, 'unit': UNIT.get(page, page[:3]),
                        **({'acting': True} if acting else {}), **({'note': note} if note else {}), **({'wiki': links[name]} if name in links else {})})
    if not any(counted(t) for t in out):
        raise SystemExit(f'{page}：沒有讀到民選首長')
    return out


# 一段期間裡各黨在任幾天：sides 是同一天要平均的幾邊（合併前的縣、市），每一邊是一串任期
def tally(sides, d0, since, until):
    t, total = {k: 0.0 for k, _, _ in PARTIES}, 0
    d = max(d0, since or d0)
    while d < until:
        on = []
        for ts in sides:
            cur = [x for x in ts if x['start'] <= d < x['end'] and counted(x)]
            if cur:
                on.append(cur[-1]['party'])  # 重疊（維基日期筆誤）取後一位
        if on:
            for p in on:
                t[p] += 1 / len(on)
            total += 1
        d += timedelta(days=1)
    # 這段期間都沒有民選首長（金門、連江 1993 年前）：days 0、share 空的
    return {'days': total, 'share': {k: round(v / total, 4) for k, v in t.items() if v}}


def periods_of(sides):
    d0 = min(x['start'] for ts in sides for x in ts if counted(x))
    return {key: tally(sides, d0, a, b) for key, (a, b) in PERIODS.items()}


iso = lambda ts: [{**t, 'start': t['start'].isoformat(), 'end': t['end'].isoformat()} for t in sorted(ts, key=lambda t: t['start'])]


def main():
    counties, old = {}, {}
    for county, pages in COUNTIES.items():
        units = [terms(p, h) for p, h in pages]
        allt = [t for u in units for t in u]
        # 合併的縣市：同一天兩個條目（市、縣）的首長平均；升格前後（臺北縣→新北市）不會同一天都有，自然接起來
        # 先把條目依「合併前的哪一邊」分組：新北、桃園兩個條目是同一邊
        sides = {}
        for t in allt:
            side = t['unit'] if county in MERGED else county
            if county in MERGED and t['unit'] == county[:3] and t['start'] >= MERGE_DAY:
                side = 'after'
            sides.setdefault(side, []).append(t)
        first = lambda ts: min(t['start'] for t in ts if counted(t)).isoformat()  # 第一任民選
        counties[county] = {'from': first(allt), 'periods': periods_of(list(sides.values())), 'terms': iso(allt)}
        print(county, {k: f"{v['days'] / 365.25:.0f}年 " + ' '.join(f'{p}{x:.0%}' for p, x in v['share'].items()) for k, v in counties[county]['periods'].items()})
        # 合併前的舊縣、舊市各自算（舊底圖用）：只看自己那一邊
        if county in MERGED:
            for side in (county, county[:2] + '縣'):
                ts = sides[side]
                old[OLD_KEY.get(side, side)] = {'from': first(ts), 'periods': periods_of([ts]), 'terms': iso(ts)}
    out = {'asOf': AS_OF.isoformat(), 'periods': {k: [a and a.isoformat(), b.isoformat()] for k, (a, b) in PERIODS.items()}, 'parties': [{'key': k, 'label': l, 'names': n} for k, l, n in PARTIES], 'counties': counties, 'old': old}
    (ROOT / 'src/data/mayor-history.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
