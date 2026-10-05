import sys,zipfile,json,pathlib,hashlib
sys.path.insert(0,'.geo-reference/python');import shapefile
box=[26.6,52.5,32.1,55.35];features=[];hashes={}
# Clip individual segments; maintain separate parts, do not join outside-map river stretches.
def clip(a,b):
 x,y=a;dx=b[0]-x;dy=b[1]-y;t0,t1=0,1
 for p,q in [(-dx,x-box[0]),(dx,box[2]-x),(-dy,y-box[1]),(dy,box[3]-y)]:
  if p==0:
   if q<0:return None
  else:
   t=q/p
   if p<0:t0=max(t0,t)
   else:t1=min(t1,t)
 if t0>t1:return None
 return [[round(x+t0*dx,6),round(y+t0*dy,6)],[round(x+t1*dx,6),round(y+t1*dy,6)]]
for dataset in ['rivers','rivers-europe','lakes']:
 data=pathlib.Path('.geo-reference/'+dataset+'.zip').read_bytes();hashes[dataset]=hashlib.sha256(data).hexdigest();z=zipfile.ZipFile('.geo-reference/'+dataset+'.zip');z.extractall('.geo-reference/'+dataset)
 r=shapefile.Reader(str(next(pathlib.Path('.geo-reference/'+dataset).glob('*.shp'))))
 for sr in r.iterShapeRecords():
  d=sr.record.as_dict();name=d.get('name_en') or d.get('name') or ''
  if dataset!='lakes' and name not in ['Dnieper','Daugava','Berezina','Drut','Sozh','Ula','Neris']:continue
  if d.get('featurecla')=='Lake Centerline' and name!='Drut':continue
  x1,y1,x2,y2=sr.shape.bbox
  if x1>box[2] or x2<box[0] or y1>box[3] or y2<box[1]:continue
  pts=sr.shape.points;cuts=list(sr.shape.parts)+[len(pts)];parts=[]
  for begin,end in zip(cuts,cuts[1:]):
   chain=[]
   for a,b in zip(pts[begin:end-1],pts[begin+1:end]):
    seg=clip(a,b)
    if not seg:
     if chain:parts.append(chain);chain=[]
    else:
     if chain and chain[-1]!=seg[0]:parts.append(chain);chain=[]
     if not chain:chain.append(seg[0])
     chain.append(seg[1])
   if chain:parts.append(chain)
  if parts:features.append({'name':name or ('Naroch' if x1<27 else 'Lukoml'),'kind':'lake' if dataset=='lakes' else 'river','sourceDataset':dataset,'featureClass':d.get('featurecla'),'parts':parts})
out={'source':'Natural Earth 1:10m physical v5.0.0; public domain; Europe supplement derived from JRC CCM','bbox':box,'sha256':hashes,'features':features}
pathlib.Path('experiments/grand-campaign-002/hydrology.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print([(f['name'],len(f['parts'])) for f in features])
