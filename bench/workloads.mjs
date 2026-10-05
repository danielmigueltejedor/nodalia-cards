export function scenarios(config) {
 const shared=config.commonCards, output=[];
 for(const id of shared)for(const kind of ['mount','warm-remount','unrelated','relevant'])output.push({id:`${kind}/${id}`,scope:'common'});
 for(const id of ['mount','unrelated','relevant'])output.push({id:`dashboard/${id}`,scope:'common'});
 if(shared.includes('media')){for(const count of config.trackUpdates)output.push({id:`tracks/media/${count}`,scope:'common'});for(const mode of ['cached','cold','failed'])output.push({id:`artwork/media/${mode}`,scope:'common'});}
 if(shared.includes('graph')){for(const points of config.graphPoints)output.push({id:`graph/graph/${points}`,scope:'common'});output.push({id:'graph-toggle/graph',scope:'common'},{id:'resize/graph',scope:'common'});}
 for(const rows of ['auto','fixed'])if(shared.includes('graph'))output.push({id:`sections/graph/${rows}`,scope:'common'});
 if(shared.includes('advance-vacuum'))for(const type of ['pointer','touch'])for(const count of config.gestureMoves)output.push({id:`gesture/advance-vacuum/${type}/${count}`,scope:type==='pointer'?'3.0-only':'common'});
 if(shared.includes('advance-vacuum'))for(const mode of ['auto','explicit','robot-switch'])output.push({id:`helpers/advance-vacuum/${mode}`,scope:'common'});
 output.push({id:'engine-session/advance-vacuum',scope:'3.0-only'});
 for(const id of ['media','graph','advance-vacuum','light'].filter(id=>shared.includes(id)))for(const count of config.lifecycleCycles)output.push({id:`lifecycle/${id}/${count}`,scope:'common'});
 return output;
}
