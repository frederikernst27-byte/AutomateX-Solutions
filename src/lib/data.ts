import {
  Briefcase,
  type LucideIcon,
  Tag,
  Users,
  Database,
  Shuffle,
  Link as LinkIcon,
  DollarSign,
  Mail,
  FileText,
  Filter,
} from 'lucide-react';
import type { WorkflowNode } from '@/components/workflow-diagram';

export type Service = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const services: Service[] = [
  {
    title: 'ERP Integration',
    description: 'Seamlessly connect your ERP system with other applications to automate data synchronization and streamline business processes.',
    icon: Database,
  },
  {
    title: 'Custom n8n Automations',
    description: 'We design and build bespoke n8n workflows tailored to your specific operational needs, from simple tasks to complex logic.',
    icon: Shuffle,
  },
  {
    title: 'API Integrations',
    description: 'Integrate various SaaS platforms and internal tools through their APIs to create a unified and automated ecosystem.',
    icon: LinkIcon,
  },
];

export type AutomationExample = {
  title: string;
  description: string;
  icon: LucideIcon;
  workflow: WorkflowNode[];
};

export const automationExamples: AutomationExample[] = [
  {
    title: 'TalentMatch Recruiting',
    description: 'An integrated recruiting process that automatically handles applications, schedules interviews, and communicates with candidates.',
    icon: Briefcase,
    workflow: [
      { id: '1', label: 'Web Form Application', icon: FileText },
      { id: '2', label: 'Add to CRM', icon: Users },
      { id: '3', label: 'Schedule Interview', icon: Mail },
      { id: '4', label: 'Update Candidate', icon: Briefcase },
    ],
  },
  {
    title: 'Daily Deal Notifications',
    description: 'An automation that scrapes the latest deals from various platforms and sends a curated daily digest to subscribers.',
    icon: Tag,
    workflow: [
      { id: '1', label: 'Fetch Deals', icon: LinkIcon },
      { id: '2', label: 'Filter & Format', icon: Filter },
      { id: '3', label: 'Send Daily Email', icon: Mail },
    ],
  },
  {
    title: 'Automated Quote Requests',
    description: 'A process that automatically generates quotes and applies discounts for product inquiries, notifying customers via email.',
    icon: DollarSign,
    workflow: [
      { id: '1', label: 'Product Inquiry', icon: Mail },
      { id: '2', label: 'Generate Quote', icon: FileText },
      { id: '3', label: 'Send Quote to Customer', icon: Mail },
    ],
  },
  {
    title: 'Automated Lead Qualification',
    description: 'Link a web form to a database that automatically analyzes, scores, and categorizes leads based on predefined criteria.',
    icon: Users,
    workflow: [
      { id: '1', label: 'New Lead Form', icon: FileText },
      { id: '2', label: 'Analyze & Score', icon: Filter },
      { id: '3', label: 'Categorize in DB', icon: Database },
      { id: '4', label: 'Notify Sales Team', icon: Mail },
    ],
  },
];

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  imageId: string;
  content: string;
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'getting-started-with-n8n',
    title: 'Getting Started with n8n: A Beginner\'s Guide to Automation',
    description: 'Learn the basics of n8n and how to build your first workflow to automate repetitive tasks.',
    date: '2024-07-15',
    author: 'Alex Johnson',
    imageId: 'blog-1',
    content: `
<p>Automation is no longer a luxury; it's a necessity for businesses looking to scale and improve efficiency. n8n is a powerful, free, and open-source workflow automation tool that allows you to connect various services and APIs without writing code. In this guide, we'll walk you through the basics of n8n and help you build your very first workflow.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">What is n8n?</h3>
<p>n8n (pronounced "n-eight-n") is a fair-code licensed tool that lets you automate tasks across different web services. Think of it as a digital assembly line where you can define a series of steps (nodes) that data should pass through. Each node performs a specific action, like reading from a database, sending an email, or updating a CRM.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">Building Your First Workflow: A Simple Example</h3>
<p>Let's create a simple workflow that triggers every time you receive a new email with a specific subject and then sends a notification to a Slack channel.</p>
<ol class="list-decimal list-inside space-y-2 my-4">
  <li><strong>Set up the Trigger Node:</strong> Start with an "Email Read IMAP" node. Configure it with your email server credentials and specify the subject line to look for.</li>
  <li><strong>Add an Action Node:</strong> Connect a "Slack" node to the trigger. Authenticate with your Slack workspace.</li>
  <li><strong>Configure the Action:</strong> In the Slack node, specify the channel and customize the message. You can use data from the trigger node (like the email sender or body) in your Slack message.</li>
</ol>
<p>And that's it! Activate your workflow, and you've just automated a part of your daily routine. This is just the tip of the iceberg. With hundreds of integrations, n8n can handle incredibly complex automations.</p>
    `,
  },
  {
    slug: '5-automations-to-boost-your-sales-team',
    title: '5 Essential n8n Automations to Boost Your Sales Team',
    description: 'Discover five powerful workflows that can save your sales team time, improve lead management, and close more deals.',
    date: '2024-07-08',
    author: 'Jane Doe',
    imageId: 'blog-2',
    content: `
<p>A sales team's most valuable asset is time. By automating repetitive administrative tasks, you can free up your team to focus on what they do best: selling. Here are five essential n8n automations that can supercharge your sales process.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">1. Automated Lead Qualification</h3>
<p>Automatically score and qualify leads from your web forms based on criteria like company size, industry, or budget. High-value leads can be instantly assigned to a sales rep and added to your CRM, while lower-priority leads can be added to a nurturing sequence.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">2. CRM Enrichment</h3>
<p>When a new lead is added, use n8n to automatically enrich their profile with data from sources like Clearbit or Hunter.io. This gives your sales team a complete picture of the prospect without any manual research.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">3. Deal Alerts in Slack</h3>
<p>Create a workflow that sends a notification to a dedicated Slack channel whenever a deal in your CRM (like HubSpot or Salesforce) moves to a new stage. This keeps the entire team in the loop and celebrates wins in real-time.</p>
<p>These are just a few examples. The possibilities with n8n are endless, allowing you to build a sales machine that is both efficient and effective.</p>
    `,
  },
  {
    slug: 'erp-integration-with-n8n',
    title: 'The Power of ERP Integration with n8n',
    description: 'Learn how connecting your ERP system to other applications using n8n can unlock new levels of efficiency and data accuracy.',
    date: '2024-06-25',
    author: 'Sam Smith',
    imageId: 'blog-3',
    content: `
<p>Enterprise Resource Planning (ERP) systems are the backbone of many businesses, but they often exist in a silo. By integrating your ERP with other tools using n8n, you can create a seamless flow of information across your entire organization, reducing manual data entry and eliminating errors.</p>
<h3 class="font-headline text-xl font-bold mt-6 mb-2">Example: Order-to-Cash Automation</h3>
<p>Imagine a customer places an order on your e-commerce site. An n8n workflow can automate the entire order-to-cash process:</p>
<ol class="list-decimal list-inside space-y-2 my-4">
  <li><strong>Order Creation:</strong> A trigger node detects a new order in your e-commerce platform (e.g., Shopify).</li>
  <li><strong>ERP Entry:</strong> The workflow creates a new sales order in your ERP system (e.g., SAP, NetSuite).</li>
  <li><strong>Inventory Check:</strong> It checks inventory levels in the ERP. If an item is out of stock, it can notify the purchasing team.</li>
  <li><strong>Invoice Generation:</strong> Once the order is fulfilled, an invoice is automatically generated in your accounting software (e.g., QuickBooks) and sent to the customer.</li>
</ol>
<p>This level of integration ensures data consistency, speeds up processes, and provides a better customer experience. At AutomateX, we specialize in building these complex ERP integrations to help your business run smoother.</p>
    `,
  },
];
