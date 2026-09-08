import React, { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import FlowBuilder from './FlowBuilder.jsx';
import { createWhatsappFlow } from './api.js';

const CATEGORIES = [
  'SIGN_UP',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER'
];

const TEMPLATES_WITHOUT_ENDPOINT = [
  { id: 'default', label: 'Default', description: 'Start from scratch' },
  { id: 'purchase', label: 'Collect purchase interest', description: 'Get details about what customers want to buy' },
  { id: 'feedback', label: 'Get feedback', description: 'Ask customers for their opinion' },
  { id: 'survey', label: 'Send a survey', description: 'Conduct a simple survey' },
  { id: 'support', label: 'Customer support', description: 'Help customers resolve issues' },
];

const TEMPLATES_WITH_ENDPOINT = [
  { id: 'loan_leads', label: 'Get leads for a pre-approved loan / credit card', description: 'Endpoint template available' },
  { id: 'insurance', label: 'Provide insurance quote', description: 'Endpoint template available' },
  { id: 'personalized_offer', label: 'Capture interest for a personalized offer', description: 'Endpoint template available' },
  { id: 'account_signup', label: 'Account Sign in / Sign up', description: 'Endpoint template available' },
  { id: 'appointment', label: 'Appointment booking', description: 'Endpoint template available' },
];

const TEMPLATE_FLOWS = {
  default: {
    screens: [
      {
        id: 'screen_one',
        title: 'This is a sample form',
        layout: [
          { type: 'Text', text: 'This is a sample lead-gen form!', className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Input', label: 'Your Name', placeholder: 'Enter your name' },
          { type: 'Input', label: 'Appointment Time', placeholder: 'Select time' },
          { type: 'Text', text: 'Select any time between 9 am to 6 pm.', className: 'text-xs text-slate-500 mb-4' },
          { type: 'Label', text: 'Interested Services', className: 'font-medium mb-2 text-slate-900' },
          { type: 'Checkbox', label: 'Service 1' },
          { type: 'Checkbox', label: 'Service 2' },
          { type: 'Checkbox', label: 'Service 3' },
          { type: 'Checkbox', label: 'Send reminders for appointment?', className: 'mt-4' },
        ],
        button: 'Continue'
      }
    ]
  },
  purchase: {
    screens: [
      {
        id: 'screen_one',
        title: 'Join Now',
        layout: [
          { type: 'Text', text: 'Get early access to our Mega Sales Day deals. Register now!', className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Input', label: 'Name' },
          { type: 'Input', label: 'Email' },
          { type: 'Checkbox', label: 'I agree to the terms. Read more', className: 'mt-2' },
          { type: 'Checkbox', label: 'Keep me up to date about offers and promotions' },
        ],
        button: 'Continue'
      }
    ]
  },
  survey: {
    screens: [
      {
        id: 'screen_one',
        title: 'Question 1 of 3',
        layout: [
          { type: 'Text', text: "You've found the perfect deal, what do you do next?", className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Label', text: 'Choose all that apply:', className: 'text-sm text-slate-600 mb-2' },
          { type: 'Checkbox', label: 'Buy it right away' },
          { type: 'Checkbox', label: 'Check reviews before buying' },
          { type: 'Checkbox', label: 'Share it with friends + family' },
          { type: 'Checkbox', label: 'Buy multiple, while its cheap' },
          { type: 'Checkbox', label: 'None of the above' },
        ],
        button: 'Continue'
      },
      {
        id: 'screen_two',
        title: 'Question 2 of 3',
        layout: [
            { type: 'Text', text: "How often do you shop online?", className: 'font-bold text-lg mb-4 text-slate-900' },
            { type: 'Radio', label: 'Frequency', options: ['Weekly', 'Monthly', 'Rarely'] },
        ],
        button: 'Continue'
      },
      {
         id: 'screen_three',
         title: 'Question 3 of 3',
         layout: [
             { type: 'Text', text: "Thank you for your time!", className: 'font-bold text-lg mb-4 text-slate-900' },
             { type: 'Text', text: "We appreciate your feedback.", className: 'text-sm text-slate-600' }
         ],
         button: 'Submit'
      }
    ]
  },
  support: {
      screens: [
          {
              id: 'screen_one',
              title: 'Get help',
              layout: [
                  { type: 'Input', placeholder: 'Name', className: 'mb-4' },
                  { type: 'Input', placeholder: 'Order number', className: 'mb-4' },
                  { type: 'Label', text: 'Choose a topic', className: 'font-medium text-slate-900 mb-3' },
                  { type: 'Radio', label: 'Topic', options: ['Orders and payments', 'Maintenance', 'Delivery', 'Returns', 'Other'] },
                  { type: 'Input', placeholder: 'Description of issue (Optional)', multiline: true, rows: 4, className: 'mt-6' }
              ],
              button: 'Done'
          }
      ]
  },
  feedback: {
      screens: [
          {
              id: 'screen_one',
              title: 'Feedback 1 of 2',
              layout: [
                  { type: 'Text', text: 'Would you recommend us to a friend?', className: 'font-bold text-lg mb-4 text-slate-900' },
                  { type: 'Label', text: 'Choose one', className: 'text-sm text-slate-600 mb-2' },
                  { type: 'Radio', label: 'Recommend', options: ['Yes', 'No'] },
                  { type: 'Label', text: 'How could we do better?', className: 'font-bold mt-6 mb-2 text-slate-900' },
                  { type: 'Input', placeholder: 'Leave a comment (Optional)', multiline: true, rows: 4 }
              ],
              button: 'Continue'
          },
           {
              id: 'screen_two',
              title: 'Feedback 2 of 2',
              layout: [
                  { type: 'Text', text: 'Thank you for your feedback!', className: 'font-bold text-lg mb-4 text-slate-900' }
              ],
              button: 'Submit'
          }
      ]
  }
};

// Map new endpoint templates to default structure for now
['loan_leads', 'insurance', 'personalized_offer', 'account_signup', 'appointment'].forEach(id => {
  TEMPLATE_FLOWS[id] = TEMPLATE_FLOWS.default;
});

export default function FlowsCreate({ onCancel, onSave }) {
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('whatsapp_flows_create_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [activeTab, setActiveTab] = useState('WITHOUT_ENDPOINT');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('whatsapp_flows_create_data');
    return saved ? JSON.parse(saved) : {
      name: '',
      categories: [],
      template: 'default'
    };
  });

  useEffect(() => {
    localStorage.setItem('whatsapp_flows_create_step', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem('whatsapp_flows_create_data', JSON.stringify(formData));
  }, [formData]);

  const clearStorage = () => {
    localStorage.removeItem('whatsapp_flows_create_step');
    localStorage.removeItem('whatsapp_flows_create_data');
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
  };

  const handleCancel = () => {
    clearStorage();
    onCancel();
  };

  // Reset preview state when template changes
  useEffect(() => {
    setIsPreviewOpen(false);
    setCurrentScreenIndex(0);
  }, [formData.template]);

  const handleNext = () => {
    if (!formData.name) {
      alert('Please enter a form name');
      return;
    }
    // Clear builder storage to ensure fresh start
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
    setStep(2);
  };

  const mapToMetaComponent = (component) => {
    // Generate a clean name for the form field - MUST be lowercase, no spaces
    // Prefer component.name if set, otherwise derive from label, otherwise fallback to clean ID or random
    let cleanName = '';
    if (component.name) {
      cleanName = component.name.toLowerCase();
    } else if (component.label) {
      // Create ID from label (e.g. "Your Name" -> "your_name")
      cleanName = component.label.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }

    if (!cleanName || cleanName.length < 2) {
       // Fallback to ID or random if label yielded empty/short string
       cleanName = (component.id || `field_${Math.random().toString(36).substr(2, 9)}`)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
    }

    const fieldName = cleanName;

    const base = {
      visible: true,
      name: fieldName,
    };

    switch (component.type) {
      case 'Text':
        // STRICT RULE: Allowed styles are 'body', 'caption', 'heading'
        // DO NOT use font-size, font-weight
        // Updated to use TextHeading and TextBody for v3.0+

        if (component.variant === 'largeHeading' || (component.className && component.className.includes('text-lg')) || component.className?.includes('font-bold')) {
           return {
             type: 'TextHeading',
             text: component.text || '',
           };
        } else if (component.variant === 'caption' || (component.className && component.className.includes('text-xs'))) {
           // Caption maps to TextCaption in some versions, or TextBody with smaller style?
           // For now, mapping everything else to TextBody as requested
           return {
             type: 'TextBody',
             text: component.text || '',
           };
        }

        return {
          type: 'TextBody',
          text: component.text || '',
        };

      case 'TextArea':
        return {
          type: 'TextArea',
          ...base,
          label: component.label || 'Details',
          required: component.required || false,
          'max-length': component.maxLength || 300
        };

      case 'Input':
        // STRICT RULE: Allowed input-types: text, email, phone, number, password
        let inputType = 'text';
        const labelLower = (component.label || '').toLowerCase();

        if (component.inputType) {
           inputType = component.inputType;
        } else if (labelLower.includes('email')) {
           inputType = 'email';
        } else if (labelLower.includes('phone') || labelLower.includes('mobile')) {
           inputType = 'phone';
        } else if (labelLower.includes('number')) {
           inputType = 'number';
        } else if (labelLower.includes('password')) {
           inputType = 'text'; // Password type not supported in WhatsApp Flows
        }

        // Ensure inputType is valid
        if (!['text', 'email', 'phone', 'number'].includes(inputType)) {
           inputType = 'text';
        }

        // Determine required status - Auto-require contact fields for lead gen best practice
        let isRequired = component.required || false;
        if (['email', 'phone'].includes(inputType) || labelLower.includes('name')) {
           isRequired = true;
        }

        return {
          type: 'TextInput',
          ...base,
          label: component.label || 'Input',
          required: isRequired,
          'input-type': inputType,
        };

      case 'Checkbox':
        // Handle both single boolean checkbox and multiple choice group
        if (component.options && component.options.length > 0) {
           return {
             type: 'CheckboxGroup',
             ...base,
             label: component.label || 'Select options',
             required: component.required || false,
             'data-source': component.options.map(opt => ({
               id: opt.replace(/\s+/g, '_').toLowerCase(),
               title: opt
             }))
           };
        } else {
           // Single checkbox (e.g. Terms) - mapped to Checkbox type as requested
           // If that fails, fallback to CheckboxGroup with single option

           // Clean field name for terms/privacy
           let singleName = base.name;
           if (component.label && (component.label.toLowerCase().includes('term') || component.label.toLowerCase().includes('privacy'))) {
              singleName = 'terms';
           } else if (component.label && (component.label.toLowerCase().includes('promo') || component.label.toLowerCase().includes('offer'))) {
              singleName = 'promotions';
           }

           // Check if it's a "Read more" link case and sanitize
           let labelText = component.label || component.text || 'Yes';
           if (labelText.includes('Read more')) {
              labelText = labelText.replace('Read more', 'and privacy policy');
           }

           return {
             type: 'OptIn',
             name: singleName,
             visible: true,
             label: labelText,
             required: component.required !== undefined ? component.required : false // Default to false for single checkboxes (avoid blocking UX)
           };
        }

      case 'Radio':
        return {
          type: 'RadioButtonsGroup',
          ...base,
          label: component.label || 'Select one',
          required: component.required || false,
          'data-source': (component.options || []).map(opt => ({
            id: opt.replace(/\s+/g, '_').toLowerCase(),
            title: opt
          }))
        };

      case 'Dropdown':
        return {
          type: 'Dropdown',
          ...base,
          label: component.label || 'Select',
          required: component.required || false,
          'data-source': (component.options || []).map(opt => ({
             id: opt.replace(/\s+/g, '_').toLowerCase(),
             title: opt
          }))
        };

      case 'Image':
        if (!component.src) return null;
        return {
           type: 'Image',
           src: component.src,
           'scale-type': component['scale-type'] || 'cover',
           visible: true
        };

      case 'Date':
        return {
          type: 'DatePicker',
          ...base,
          label: component.label || 'Select date',
          required: component.required || false
        };

      case 'Label':
         return {
            type: 'TextBody',
            text: `*${component.text || ''}*`, // Bold using markdown
            visible: true
         };

      default:
        return null;
    }
  };

  const transformToMetaFlow = (screens) => {
    // Helper to generate safe IDs (no numbers)
    const getSafeScreenId = (idx) => {
       const letters = 'abcdefghijklmnopqrstuvwxyz';
       return `screen_${letters[idx % 26]}${Math.floor(idx / 26) || ''}`;
    };

    const transformedScreens = screens.map((screen, index) => {
      const isLastScreen = index === screens.length - 1;
      const nextScreenId = isLastScreen ? null : getSafeScreenId(index + 1);

      // Filter and map components
      const formChildren = (screen.content || [])
        .map(mapToMetaComponent)
        .filter(Boolean);

      // Add Footer inside the Form
      formChildren.push({
        type: 'Footer',
        label: screen.button || (isLastScreen ? 'Submit' : 'Continue'),
        'on-click-action': isLastScreen
          ? {
              name: 'complete',
              payload: {
                screen_values: '${form}' // Must be an object
              }
            }
          : {
              name: 'navigate',
              next: {
                type: 'screen',
                name: nextScreenId
              }
            }
      });

      return {
        id: getSafeScreenId(index),
        title: screen.title || 'Untitled Screen',
        terminal: isLastScreen,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form',
              children: formChildren
            }
          ]
        }
      };
    });

    // Generate routing_model
    const routingModel = {};
    transformedScreens.forEach((screen, index) => {
       const isLastScreen = index === transformedScreens.length - 1;
       if (!isLastScreen) {
          const nextScreenId = getSafeScreenId(index + 1);
          routingModel[screen.id] = [nextScreenId];
       } else {
          routingModel[screen.id] = [];
       }
    });

    return {
      version: '7.3',
      data_api_version: '4.0',
      routing_model: routingModel,
      screens: transformedScreens
    };
  };

  const handleSaveFlow = async (screens, status) => {
    setIsSaving(true);
    try {
      const flowJson = transformToMetaFlow(screens);

      const payload = {
        name: formData.name,
        categories: formData.categories,
        publish: status === 'PUBLISHED',
        flow_json: flowJson
      };
      await createWhatsappFlow(payload);
      clearStorage();
      onSave();
    } catch (err) {
      console.error(err);
      let errorMsg = err.message || 'Unknown error';
      if (err.details && err.details.validation_errors) {
         errorMsg += '\n\nValidation Errors:\n' + err.details.validation_errors.map(e =>
            `- ${e.error || 'Error'}: ${e.message} (Line ${e.line_start})`
         ).join('\n');
      }
      alert('Failed to save flow: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 2) {
    const selectedTemplate = TEMPLATE_FLOWS[formData.template] || TEMPLATE_FLOWS.default;
    const initialScreens = selectedTemplate.screens.map(s => ({
        ...s,
        content: s.layout.map((c, i) => ({ ...c, id: `c_${i}_${Date.now()}` }))
    }));

    return (
      <FlowBuilder
        onBack={() => setStep(1)}
        flowData={formData}
        initialScreens={initialScreens}
        onSave={handleSaveFlow}
      />
    );
  }

  const currentFlow = TEMPLATE_FLOWS[formData.template] || TEMPLATE_FLOWS.default;
  const currentScreen = currentFlow.screens[currentScreenIndex];
  const totalScreens = currentFlow.screens.length;

  const handlePreviewAction = () => {
    if (currentScreenIndex < totalScreens - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1);
    } else {
      setIsPreviewOpen(false);
      setTimeout(() => setCurrentScreenIndex(0), 300); // Reset after closing animation
    }
  };

  const renderComponent = (cmp, idx) => {
    switch (cmp.type) {
      case 'Text':
        return <div key={idx} className={cmp.className}>{cmp.text}</div>;
      case 'Input':
        return (
          <div key={idx} className={`space-y-1 mb-3 ${cmp.className || ''}`}>
            {cmp.label && <div className="text-sm text-slate-600 font-medium">{cmp.label}</div>}
            {cmp.multiline ? (
               <textarea
              className="w-full p-3 border border-purple-100 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none resize-none"
                 rows={cmp.rows || 3}
                 placeholder={cmp.placeholder}
               />
            ) : (
              <input
                type="text"
                className="w-full h-11 px-4 border border-purple-100 rounded-2xl bg-white text-slate-900 text-sm focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none"
                placeholder={cmp.placeholder || ''}
              />
            )}
          </div>
        );
      case 'Checkbox':
        return (
          <label key={idx} className={`flex items-start gap-3 mb-2 cursor-pointer ${cmp.className || ''}`}>
            <input type="checkbox" className="w-5 h-5 border-purple-200 rounded text-purple-600 focus:ring-purple-500 mt-0.5" />
            <span className="text-sm text-slate-700">{cmp.label}</span>
          </label>
        );
      case 'Radio':
        return (
          <label key={idx} className={`flex items-center justify-between mb-4 cursor-pointer ${cmp.className || ''}`}>
            <span className="text-sm text-slate-700">{cmp.label}</span>
            <input
              type="radio"
              name={`screen_${currentScreenIndex}`}
              className="w-5 h-5 border-purple-200 text-purple-600 focus:ring-purple-500"
            />
          </label>
        );
      case 'Label':
        return <div key={idx} className={cmp.className}>{cmp.text}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f3f1f8]">
      {/* Header */}
      <div className="px-6 py-5">
        <div className="relative overflow-hidden rounded-[34px] border border-white bg-white p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-100 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-white shadow-xl shadow-purple-200">
                <Smartphone className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-purple-500">WhatsApp Flow</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Create WhatsApp Form</h2>
                <p className="mt-1 text-sm text-slate-500">Configure the flow details, choose a template, then preview before saving.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 rounded-2xl border-purple-100 bg-white px-5" onClick={handleCancel}>
                Cancel
              </Button>
              <Button className="h-12 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700" onClick={handleNext}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-5 px-6 pb-6">
        {/* Left Form Area */}
        <div className="flex-1 overflow-y-auto rounded-[34px] border border-white bg-white p-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            {/* Name Input */}
            <div className="rounded-[28px] border border-purple-100 bg-purple-50/40 p-5">
              <div className="flex justify-between">
                <label className="text-sm font-bold text-slate-800">Name</label>
                <span className="text-xs font-bold text-slate-400">{formData.name.length}/20</span>
              </div>
              <Input
                placeholder="Enter Name"
                maxLength={20}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-3 h-12 rounded-2xl border-purple-100 bg-white"
              />
            </div>

            {/* Categories */}
            <div className="rounded-[28px] border border-white bg-slate-50/80 p-5">
              <label className="text-sm font-bold text-slate-800">Categories</label>
              <div className="relative mt-3">
                <select
                  className="h-12 w-full appearance-none rounded-2xl border border-purple-100 bg-white px-4 py-2 text-sm font-semibold focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={formData.categories[0] || ''}
                  onChange={(e) => setFormData({...formData, categories: [e.target.value]})}
                >
                  <option value="" disabled>Select Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            </div>

            {/* Templates */}
            <div className="rounded-[28px] border border-white bg-white p-5 shadow-sm ring-1 ring-purple-50">
              <label className="text-sm font-bold text-slate-800">Templates</label>

              {/* Template Tabs */}
              <div className="mb-4 mt-4 flex gap-2 rounded-2xl bg-slate-100 p-1">
                 <button
                   className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'WITHOUT_ENDPOINT' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   onClick={() => setActiveTab('WITHOUT_ENDPOINT')}
                 >
                   Without Endpoint
                 </button>
                 <button
                   className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'WITH_ENDPOINT' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   onClick={() => setActiveTab('WITH_ENDPOINT')}
                 >
                   With Endpoint
                 </button>
              </div>

              <div className="space-y-3">
                {(activeTab === 'WITHOUT_ENDPOINT' ? TEMPLATES_WITHOUT_ENDPOINT : TEMPLATES_WITH_ENDPOINT).map(tmpl => (
                  <label
                    key={tmpl.id}
                    className={`flex cursor-pointer items-start gap-4 rounded-[22px] border p-4 transition-all ${
                      formData.template === tmpl.id
                        ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/60'
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-purple-700 shadow-sm">
                      <input
                        type="radio"
                        name="template"
                        className="w-4 h-4 text-purple-600 border-purple-200 focus:ring-purple-500"
                        checked={formData.template === tmpl.id}
                        onChange={() => setFormData({...formData, template: tmpl.id})}
                      />
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-slate-950">{tmpl.label}</span>
                      {tmpl.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">{tmpl.description}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Area */}
        <div className="w-[460px] rounded-[34px] border border-white bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Live Preview</div>
              <div className="text-xs text-slate-500">WhatsApp customer view</div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Flow</span>
          </div>

          {/* Phone Mockup */}
          <div className="w-[320px] h-[640px] bg-white rounded-[3rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            {/* Status Bar */}
            <div className="h-6 bg-slate-800 w-full absolute top-0 z-10 flex justify-center">
                <div className="h-4 w-32 bg-black rounded-b-xl"></div>
            </div>

            {/* App Header (WhatsApp Style) */}
            <div className="mt-6 bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-md z-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-semibold">Business Name</div>
                    <div className="text-[10px] opacity-80">Official Business Account</div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#EFEAE2] p-4 relative overflow-hidden">
                {/* Chat Background Pattern (CSS Pattern could go here, keeping simple for now) */}

                {/* Business Message Bubble */}
                <div className="bg-white rounded-2xl p-3 shadow-sm max-w-[85%] mb-4 relative">
                    <div className="h-2 w-32 bg-slate-100 rounded mb-2"></div>
                    <div className="h-2 w-24 bg-slate-100 rounded mb-3"></div>

                    {/* CTA Button */}
                    <button
                        onClick={() => setIsPreviewOpen(true)}
                        className="w-full py-2 px-4 flex items-center justify-center gap-2 text-purple-700 font-medium text-sm border-t border-purple-100 mt-1 hover:bg-purple-50 transition-colors"
                    >
                        <Smartphone className="w-4 h-4" />
                        Preview Flow
                    </button>

                    {/* Time */}
                    <div className="text-[9px] text-slate-400 text-right mt-1">10:30 AM</div>
                </div>

                {/* Flow Modal Overlay */}
                {isPreviewOpen && (
                    <div className="absolute inset-0 bg-black/30 z-20 flex items-end animate-in fade-in duration-200">
                        <div className="w-full bg-white rounded-t-2xl h-[90%] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                            {/* Modal Header */}
                            <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between">
                                <button onClick={() => setIsPreviewOpen(false)} className="text-slate-500 hover:text-slate-800">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="font-semibold text-slate-800 text-sm">{currentScreen.title}</div>
                                <div className="w-5"></div> {/* Spacer for alignment */}
                            </div>

                            {/* Progress Bar */}
                            <div className="flex gap-1 px-4 py-2">
                                {Array.from({ length: totalScreens }).map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1 flex-1 rounded-full ${
                                            idx <= currentScreenIndex ? 'bg-purple-700' : 'bg-slate-200'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Screen Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {currentScreen.layout.map((cmp, idx) => renderComponent(cmp, idx))}
                            </div>

                            {/* Footer Button */}
                            <div className="p-4 border-t border-purple-100">
                                <button
                                    onClick={handlePreviewAction}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-800 hover:to-fuchsia-700 text-white font-medium rounded-full text-sm transition-colors shadow-sm"
                                >
                                    {currentScreen.button}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

