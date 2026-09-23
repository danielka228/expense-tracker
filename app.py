import os
from datetime import datetime, date, timedelta

from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', f"sqlite:///{os.path.join(basedir, 'expenses.db')}"
).replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

CATEGORIES = ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Прочее']


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expenses = db.relationship('Expense', backref='user', lazy=True, cascade='all, delete-orphan')


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    note = db.Column(db.String(255))
    expense_date = db.Column(db.Date, nullable=False, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper


@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Заполните все поля', 'error')
            return render_template('register.html')

        if len(password) < 4:
            flash('Пароль должен быть не короче 4 символов', 'error')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Такой пользователь уже существует', 'error')
            return render_template('register.html')

        user = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()

        session['user_id'] = user.id
        session['username'] = user.username
        flash('Регистрация прошла успешно!', 'success')
        return redirect(url_for('dashboard'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('dashboard'))

        flash('Неверный логин или пароль', 'error')

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    if request.method == 'POST':
        try:
            amount = float(request.form.get('amount', '').replace(',', '.'))
        except ValueError:
            flash('Введите корректную сумму', 'error')
            return redirect(url_for('dashboard'))

        category = request.form.get('category', 'Прочее')
        note = request.form.get('note', '').strip()
        expense_date_str = request.form.get('expense_date')
        expense_date = datetime.strptime(expense_date_str, '%Y-%m-%d').date() if expense_date_str else date.today()

        expense = Expense(
            user_id=session['user_id'],
            amount=amount,
            category=category,
            note=note,
            expense_date=expense_date
        )
        db.session.add(expense)
        db.session.commit()
        flash('Трата добавлена', 'success')
        return redirect(url_for('dashboard'))

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    all_expenses = Expense.query.filter_by(user_id=session['user_id']).order_by(Expense.expense_date.desc(), Expense.created_at.desc()).all()

    today_total = sum(e.amount for e in all_expenses if e.expense_date == today)
    week_total = sum(e.amount for e in all_expenses if e.expense_date >= week_start)
    month_total = sum(e.amount for e in all_expenses if e.expense_date >= month_start)

    by_category = {}
    for e in all_expenses:
        if e.expense_date >= month_start:
            by_category[e.category] = by_category.get(e.category, 0) + e.amount

    recent = all_expenses[:15]

    return render_template(
        'dashboard.html',
        categories=CATEGORIES,
        today=today.isoformat(),
        today_total=today_total,
        week_total=week_total,
        month_total=month_total,
        by_category=by_category,
        recent=recent,
        username=session.get('username')
    )


@app.route('/delete/<int:expense_id>', methods=['POST'])
@login_required
def delete_expense(expense_id):
    expense = Expense.query.filter_by(id=expense_id, user_id=session['user_id']).first()
    if expense:
        db.session.delete(expense)
        db.session.commit()
        flash('Запись удалена', 'success')
    return redirect(url_for('dashboard'))


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
