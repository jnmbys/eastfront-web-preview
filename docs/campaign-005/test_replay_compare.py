"""Comparator regressions using saved evidence only. Never execute a game action."""
import unittest
from copy import deepcopy
from common import HERE,read,digest
from run import compare_arm

class ReplayComparisonTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.runs={a:read(HERE/('RUN-'+a+'.json.gz')) for a in 'ABC'}
  cls.prefixes={a:read(HERE/('PREFIX-'+a+'.json.gz')) for a in 'ABC'}

 def test_separator_only_passes_both_directions_without_mutation(self):
  for arm in 'ABC':
   with self.subTest(arm=arm):
    windows=deepcopy(self.runs[arm]);posix=deepcopy(windows);p=self.prefixes[arm]
    windows['originalRuntime']=windows['originalRuntime'].replace('/','\\')
    posix['originalRuntime']=posix['originalRuntime'].replace('\\','/')
    self.assertNotEqual(windows['originalRuntime'],posix['originalRuntime'])
    before=(digest(windows),digest(posix),digest(p))
    compare_arm(windows,posix,p,p,arm);compare_arm(posix,windows,p,p,arm)
    self.assertEqual(before,(digest(windows),digest(posix),digest(p)))

 def rejected(self,edit):
  for arm in 'ABC':
   with self.subTest(arm=arm):
    old=self.runs[arm];new=deepcopy(old);op=self.prefixes[arm];np=deepcopy(op)
    new['originalRuntime']=new['originalRuntime'].replace('\\','/')
    edit(new,np)
    with self.assertRaises(AssertionError):compare_arm(old,new,op,np,arm)

 def test_game_state_difference_rejected(self):
  self.rejected(lambda r,p:r['final']['core']['rp'].__setitem__('GERMAN',r['final']['core']['rp']['GERMAN']+1))

 def test_action_difference_rejected(self):
  self.rejected(lambda r,p:r['actions'][0]['command']['action'].__setitem__('controllerId','changed-controller'))

 def test_query_difference_rejected(self):
  self.rejected(lambda r,p:r['selection'][0]['diagnostic']['context'].__setitem__('attackStrength',999))

 def test_material_difference_rejected(self):
  def edit(r,p):
   lot=next(iter(p['handoff']['materials']['lots'].values()));lot['quantity']+=1
  self.rejected(edit)

 def test_terminal_material_difference_rejected(self):
  def edit(r,p):
   lot=next(iter(r['materialTerminal']['materials']['lots'].values()));lot['quantity']+=1
  self.rejected(edit)

 def test_actual_runtime_path_difference_rejected(self):
  self.rejected(lambda r,p:r.__setitem__('originalRuntime',r['originalRuntime']+'/different-runtime'))

if __name__=='__main__':unittest.main(verbosity=2)
