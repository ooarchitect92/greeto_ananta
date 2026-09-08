import React from 'react';
export default function ParameterInput({field,value,onChange,error}) {
  const id=`parameter-${field.name}`, hint=`${id}-hint`, errId=`${id}-error`;
  const props={id,name:field.name,'aria-describedby':`${hint}${error?` ${errId}`:''}`,'aria-invalid':Boolean(error),'aria-required':field.required};
  let input;
  if (field.type === 'boolean') input=<label className="greeto-checkbox"><input {...props} type="checkbox" checked={value===true} onChange={e=>onChange(e.target.checked)}/><span>{value?'Enabled':'Disabled'}</span></label>;
  else if (field.type === 'multiselect') input=<fieldset className="greeto-options" aria-describedby={props['aria-describedby']} aria-invalid={Boolean(error)}><legend className="greeto-sr-only">{field.label}</legend>{field.options.map(option=><label key={option} className="greeto-checkbox"><input type="checkbox" name={field.name} value={option} checked={Array.isArray(value)&&value.includes(option)} onChange={e=>onChange(e.target.checked?[...(Array.isArray(value)?value:[]),option]:(Array.isArray(value)?value:[]).filter(v=>v!==option))}/><span>{option.replaceAll('_',' ')}</span></label>)}</fieldset>;
  else if (field.type === 'select') input=<select {...props} value={value??''} onChange={e=>onChange(e.target.value)}><option value="">Select an option</option>{field.options.map(option=><option key={option} value={option}>{option.replaceAll('_',' ')}</option>)}</select>;
  else if (field.type==='textarea'||field.type==='json') input=<textarea {...props} rows={field.type==='json'?7:3} spellCheck={field.type!=='json'} maxLength={field.type==='json'?16000:field.maxLength||4000} className={field.type==='json'?'greeto-code-input':''} value={typeof value==='object'?JSON.stringify(value,null,2):value??''} onChange={e=>onChange(e.target.value)}/>;
  else input=<input {...props} type={field.type==='number'?'number':field.type==='url'?'url':field.type==='time'?'time':'text'} min={field.min} max={field.max} step={field.type==='number'?(field.integer===false?'any':1):undefined} maxLength={field.maxLength||4000} placeholder={field.type==='datetime'?'2026-09-07T09:00:00+05:30':undefined} value={value??''} onChange={e=>onChange(e.target.value)} autoComplete="off"/>;
  return <div className={`greeto-field ${field.type==='json'||field.type==='textarea'?'greeto-field-wide':''}`}>
    {field.type==='multiselect'?<div className="greeto-field-label">{field.label}{field.required&&<span aria-label="required"> *</span>}</div>:<label className="greeto-field-label" htmlFor={id}>{field.label}{field.required&&<span aria-label="required"> *</span>}</label>}
    <code className="greeto-field-key">{field.name} · {field.type}</code>{input}
    <p className="greeto-field-hint" id={hint}>{field.description}</p>{error&&<p id={errId} className="greeto-field-error">{error}</p>}
  </div>;
}
