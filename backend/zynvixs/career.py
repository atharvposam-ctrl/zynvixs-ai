"""Additive career storage; existing conversation tables remain untouched."""
import json
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import db
router = APIRouter(prefix='/api/career')
KINDS = {'profile', 'resumes', 'tasks', 'applications', 'interviews', 'learning', 'drafts', 'automation'}
class Record(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(default='', max_length=100000)
    complete: bool = False
    due: str = ''
def connection():
    c = db.conn()
    c.execute('CREATE TABLE IF NOT EXISTS career_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)')
    return c
def validate(kind):
    if kind not in KINDS: raise HTTPException(404, 'Unknown career collection')
@router.get('/{kind}')
def records(kind: str):
    validate(kind)
    return [dict(id=r['id'], **json.loads(r['payload'])) for r in connection().execute('SELECT * FROM career_records WHERE kind=? ORDER BY rowid DESC', (kind,))]
@router.post('/{kind}')
def create(kind: str, record: Record):
    validate(kind)
    ident = uuid.uuid4().hex
    connection().execute('INSERT INTO career_records VALUES (?,?,?)', (ident, kind, record.model_dump_json()))
    return dict(id=ident, **record.model_dump())
@router.put('/{kind}/{ident}')
def update(kind: str, ident: str, record: Record):
    validate(kind)
    if connection().execute('UPDATE career_records SET payload=? WHERE kind=? AND id=?', (record.model_dump_json(), kind, ident)).rowcount == 0: raise HTTPException(404, 'Record not found')
    return dict(id=ident, **record.model_dump())
@router.delete('/{kind}/{ident}')
def delete(kind: str, ident: str):
    validate(kind)
    if connection().execute('DELETE FROM career_records WHERE kind=? AND id=?', (kind, ident)).rowcount == 0: raise HTTPException(404, 'Record not found')
    return {'deleted': True}
