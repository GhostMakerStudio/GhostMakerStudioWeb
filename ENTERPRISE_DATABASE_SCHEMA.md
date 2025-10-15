# 🗄️ Enterprise Database Schema
## Supporting 100+ Employees, 30+ Vehicles, $1M+ Monthly Revenue

### **Core Tables for Enterprise Operations**

---

## 👥 **User Management System**

### **users** (Employee Accounts)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(id),
    role_id UUID REFERENCES roles(id),
    manager_id UUID REFERENCES users(id),
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    status ENUM('active', 'inactive', 'terminated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **roles** (Job Roles & Permissions)
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON, -- Array of permission strings
    level INTEGER NOT NULL, -- Hierarchy level
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **departments** (Company Departments)
```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    manager_id UUID REFERENCES users(id),
    budget DECIMAL(12,2),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📋 **Project & Job Management**

### **projects** (Client Projects)
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    project_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID REFERENCES clients(id),
    project_manager_id UUID REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **tasks** (Individual Tasks)
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id),
    due_date DATETIME,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    status ENUM('pending', 'in_progress', 'completed', 'blocked') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **clients** (Client Companies)
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    billing_address TEXT,
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(12,2),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 💰 **Financial Management**

### **invoices** (Billing System)
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id),
    project_id UUID REFERENCES projects(id),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    payment_method VARCHAR(50),
    payment_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **expenses** (Expense Tracking)
```sql
CREATE TABLE expenses (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    receipt_url VARCHAR(500),
    status ENUM('pending', 'approved', 'rejected', 'reimbursed') DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **payroll** (Employee Payroll)
```sql
CREATE TABLE payroll (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES users(id),
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    base_salary DECIMAL(10,2),
    overtime_hours DECIMAL(5,2),
    overtime_rate DECIMAL(8,4),
    bonuses DECIMAL(10,2),
    deductions DECIMAL(10,2),
    net_pay DECIMAL(10,2),
    status ENUM('draft', 'approved', 'paid') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚗 **Fleet & Asset Management**

### **vehicles** (Fleet Management)
```sql
CREATE TABLE vehicles (
    id UUID PRIMARY KEY,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    vin VARCHAR(17) UNIQUE,
    assigned_driver UUID REFERENCES users(id),
    department_id UUID REFERENCES departments(id),
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    current_mileage INTEGER DEFAULT 0,
    fuel_type ENUM('gasoline', 'diesel', 'electric', 'hybrid'),
    status ENUM('active', 'maintenance', 'retired') DEFAULT 'active',
    insurance_expiry DATE,
    registration_expiry DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **vehicle_maintenance** (Maintenance Tracking)
```sql
CREATE TABLE vehicle_maintenance (
    id UUID PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id),
    maintenance_type ENUM('routine', 'repair', 'inspection', 'accident'),
    description TEXT NOT NULL,
    cost DECIMAL(10,2),
    mileage_at_service INTEGER,
    service_date DATE NOT NULL,
    next_service_date DATE,
    service_provider VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **equipment** (Equipment Inventory)
```sql
CREATE TABLE equipment (
    id UUID PRIMARY KEY,
    equipment_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    assigned_to UUID REFERENCES users(id),
    department_id UUID REFERENCES departments(id),
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    warranty_expiry DATE,
    status ENUM('active', 'maintenance', 'retired', 'lost') DEFAULT 'active',
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📊 **Time Tracking & Scheduling**

### **time_entries** (Time Clock System)
```sql
CREATE TABLE time_entries (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    task_id UUID REFERENCES tasks(id),
    clock_in DATETIME NOT NULL,
    clock_out DATETIME,
    break_duration INTEGER DEFAULT 0, -- minutes
    total_hours DECIMAL(5,2),
    hourly_rate DECIMAL(8,4),
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    status ENUM('active', 'completed', 'adjusted') DEFAULT 'active',
    notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **schedules** (Employee Scheduling)
```sql
CREATE TABLE schedules (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES users(id),
    shift_start DATETIME NOT NULL,
    shift_end DATETIME NOT NULL,
    shift_type ENUM('regular', 'overtime', 'holiday', 'on_call'),
    location VARCHAR(255),
    project_id UUID REFERENCES projects(id),
    status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📱 **Communication & Notifications**

### **messages** (Internal Messaging)
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    sender_id UUID REFERENCES users(id),
    recipient_id UUID REFERENCES users(id),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    message_type ENUM('direct', 'group', 'announcement', 'system'),
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **notifications** (System Notifications)
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('unread', 'read', 'dismissed') DEFAULT 'unread',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📈 **Analytics & Reporting**

### **analytics_events** (User Activity Tracking)
```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **reports** (Generated Reports)
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    parameters JSON,
    generated_by UUID REFERENCES users(id),
    file_url VARCHAR(500),
    status ENUM('generating', 'completed', 'failed') DEFAULT 'generating',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 **Security & Audit**

### **audit_logs** (System Audit Trail)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **user_sessions** (Session Management)
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSON,
    ip_address VARCHAR(45),
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🎯 **Implementation Notes**

### **Database Strategy**
- **Primary Database**: PostgreSQL (ACID compliance, complex queries)
- **Analytics Database**: ClickHouse (fast aggregations)
- **Cache Layer**: Redis (session storage, frequently accessed data)
- **Search**: Elasticsearch (full-text search, log analysis)

### **Scaling Considerations**
- **Partitioning**: By date for time-series data
- **Indexing**: Optimized for common query patterns
- **Archiving**: Move old data to cold storage
- **Replication**: Read replicas for reporting queries

### **Security Features**
- **Encryption**: At rest and in transit
- **Row-level security**: Data isolation by department
- **Audit trails**: Track all data changes
- **Backup strategy**: Daily backups with point-in-time recovery

---

**This schema supports a real enterprise with 100+ employees, 30+ vehicles, and $1M+ monthly revenue!** 🚀
