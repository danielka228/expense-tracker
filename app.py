import os
import re
import secrets
from datetime import datetime, date, timedelta
from io import BytesIO

from flask import Flask, render_template, request, redirect, url_for, flash, session, Response, abort, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from PIL import Image, ImageOps

basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me-in-production')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=90)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', f"sqlite:///{os.path.join(basedir, 'expenses.db')}"
).replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # фото с телефона до 10 МБ

db = SQLAlchemy(app)

CATEGORIES = ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Прочее']

CURRENCIES = {
    'RUB': {'label': 'Российский рубль', 'symbol': '₽'},
    'KZT': {'label': 'Казахстанский тенге', 'symbol': '₸'},
    'USD': {'label': 'Доллар США', 'symbol': '$'},
    'AED': {'label': 'Дирхам ОАЭ', 'symbol': 'AED'},
    'EUR': {'label': 'Евро', 'symbol': '€'},
    'KGS': {'label': 'Киргизский сом', 'symbol': 'сом'},
    'UZS': {'label': 'Узбекский сум', 'symbol': 'сум'},
}


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    currency = db.Column(db.String(10), nullable=False, default='RUB')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expenses = db.relationship('Expense', backref='user', lazy=True, cascade='all, delete-orphan')
    avatar = db.relationship('Avatar', backref='user', uselist=False, cascade='all, delete-orphan')
    api_token = db.relationship('ApiToken', backref='user', uselist=False, cascade='all, delete-orphan')


class Avatar(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    data = db.Column(db.LargeBinary, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class ApiToken(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    note = db.Column(db.String(255))
    expense_date = db.Column(db.Date, nullable=False, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    from_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        # Проверяем, что пользователь реально существует в БД
        user = User.query.get(session['user_id'])
        if not user:
            session.clear()
            flash('Сессия устарела, войдите заново', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper


def get_period_bounds(period):
    today = date.today()
    if period == 'day':
        return today
    elif period == 'week':
        return today - timedelta(days=today.weekday())
    else:
        return today.replace(day=1)


def spent_since(user_id, since_date):
    total = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.user_id == user_id,
        Expense.expense_date >= since_date
    ).scalar()
    return total or 0


def get_friend_ids(user_id):
    accepted = Friendship.query.filter(
        Friendship.status == 'accepted',
        db.or_(Friendship.from_user_id == user_id, Friendship.to_user_id == user_id)
    ).all()
    ids = set()
    for f in accepted:
        ids.add(f.to_user_id if f.from_user_id == user_id else f.from_user_id)
    return ids


def make_avatar(file_storage):
    """Приводит фото к квадрату 256x256 и сжимает в JPEG."""
    img = Image.open(file_storage.stream)
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')
    img = ImageOps.fit(img, (256, 256), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, 'JPEG', quality=85)
    return buf.getvalue()


def parse_amount(raw):
    """Достаёт число из строки: убирает пробелы (в т.ч. неразрывные), знаки валюты и т.п."""
    s = str(raw).replace(',', '.')
    s = re.sub(r'[^0-9.]', '', s)
    if s.count('.') > 1:
        head, _, tail = s.rpartition('.')
        s = head.replace('.', '') + '.' + tail
    return float(s)


@app.context_processor
def inject_currency():
    symbol = '₽'
    if 'user_id' in session:
        u = User.query.get(session['user_id'])
        if u:
            symbol = CURRENCIES.get(u.currency, CURRENCIES['RUB'])['symbol']
    return {'currency_symbol': symbol}


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

        session.permanent = True
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
            session.permanent = True
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


@app.route('/friends')
@login_required
def friends():
    period = request.args.get('period', 'month')
    if period not in ('day', 'week', 'month'):
        period = 'month'

    since_date = get_period_bounds(period)
    user_id = session['user_id']

    friend_ids = get_friend_ids(user_id)
    all_ids = list(friend_ids) + [user_id]

    board = []
    for uid in all_ids:
        u = User.query.get(uid)
        if not u:
            continue
        board.append({
            'id': u.id,
            'username': u.username,
            'is_me': uid == user_id,
            'total': spent_since(uid, since_date)
        })

    board.sort(key=lambda x: x['total'], reverse=True)

    incoming_requests = Friendship.query.filter_by(to_user_id=user_id, status='pending').all()
    incoming = []
    for r in incoming_requests:
        u = User.query.get(r.from_user_id)
        if u:
            incoming.append({'id': r.id, 'user_id': u.id, 'username': u.username})

    outgoing_requests = Friendship.query.filter_by(from_user_id=user_id, status='pending').all()
    outgoing_usernames = set()
    for r in outgoing_requests:
        u = User.query.get(r.to_user_id)
        if u:
            outgoing_usernames.add(u.username)

    return render_template(
        'friends.html',
        board=board,
        period=period,
        incoming=incoming,
        outgoing_usernames=outgoing_usernames,
        username=session.get('username')
    )


@app.route('/friends/add', methods=['POST'])
@login_required
def add_friend():
    target_username = request.form.get('friend_login', '').strip()
    user_id = session['user_id']

    if target_username == session.get('username'):
        flash('Нельзя добавить самого себя', 'error')
        return redirect(url_for('friends'))

    target = User.query.filter_by(username=target_username).first()
    if not target:
        flash('Пользователь с таким логином не найден', 'error')
        return redirect(url_for('friends'))

    existing = Friendship.query.filter(
        db.or_(
            db.and_(Friendship.from_user_id == user_id, Friendship.to_user_id == target.id),
            db.and_(Friendship.from_user_id == target.id, Friendship.to_user_id == user_id)
        )
    ).first()

    if existing:
        flash('Заявка уже отправлена или вы уже друзья', 'error')
        return redirect(url_for('friends'))

    req = Friendship(from_user_id=user_id, to_user_id=target.id, status='pending')
    db.session.add(req)
    db.session.commit()
    flash(f'Заявка отправлена пользователю {target.username}', 'success')
    return redirect(url_for('friends'))


@app.route('/friends/accept/<int:request_id>', methods=['POST'])
@login_required
def accept_friend(request_id):
    req = Friendship.query.filter_by(id=request_id, to_user_id=session['user_id'], status='pending').first()
    if req:
        req.status = 'accepted'
        db.session.commit()
        flash('Заявка принята', 'success')
    return redirect(url_for('friends'))


@app.route('/friends/decline/<int:request_id>', methods=['POST'])
@login_required
def decline_friend(request_id):
    req = Friendship.query.filter_by(id=request_id, to_user_id=session['user_id'], status='pending').first()
    if req:
        db.session.delete(req)
        db.session.commit()
        flash('Заявка отклонена', 'success')
    return redirect(url_for('friends'))


@app.route('/profile')
@login_required
def profile():
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))
    total_all_time = spent_since(user.id, date(2000, 1, 1))
    expense_count = Expense.query.filter_by(user_id=user.id).count()
    friend_count = len(get_friend_ids(user.id))
    av = Avatar.query.filter_by(user_id=user.id).first()
    tok = ApiToken.query.filter_by(user_id=user.id).first()

    return render_template(
        'profile.html',
        username=user.username,
        user_id=user.id,
        created_at=user.created_at,
        total_all_time=total_all_time,
        expense_count=expense_count,
        friend_count=friend_count,
        has_avatar=bool(av),
        avatar_v=int(av.updated_at.timestamp()) if av else 0,
        api_token=tok.token if tok else None
    )


@app.route('/avatar/<int:user_id>')
@login_required
def avatar(user_id):
    a = Avatar.query.filter_by(user_id=user_id).first()
    if not a:
        abort(404)
    resp = Response(a.data, mimetype='image/jpeg')
    resp.headers['Cache-Control'] = 'private, max-age=86400'
    return resp


@app.route('/profile/avatar', methods=['POST'])
@login_required
def upload_avatar():
    f = request.files.get('avatar')
    if not f or not f.filename:
        flash('Выберите фото', 'error')
        return redirect(url_for('profile'))
    try:
        data = make_avatar(f)
    except Exception:
        flash('Не удалось обработать фото, попробуйте другое', 'error')
        return redirect(url_for('profile'))

    a = Avatar.query.filter_by(user_id=session['user_id']).first()
    if a:
        a.data = data
        a.updated_at = datetime.utcnow()
    else:
        db.session.add(Avatar(user_id=session['user_id'], data=data))
    db.session.commit()
    flash('Фото обновлено', 'success')
    return redirect(url_for('profile'))


@app.route('/profile/avatar/delete', methods=['POST'])
@login_required
def delete_avatar():
    Avatar.query.filter_by(user_id=session['user_id']).delete()
    db.session.commit()
    flash('Фото удалено', 'success')
    return redirect(url_for('profile'))


@app.route('/profile/token', methods=['POST'])
@login_required
def regenerate_token():
    """Создаёт новый токен для быстрых команд (старый перестаёт работать)."""
    new_token = secrets.token_urlsafe(24)
    rec = ApiToken.query.filter_by(user_id=session['user_id']).first()
    if rec:
        rec.token = new_token
        rec.created_at = datetime.utcnow()
    else:
        db.session.add(ApiToken(user_id=session['user_id'], token=new_token))
    db.session.commit()
    flash('Токен создан', 'success')
    return redirect(url_for('profile'))


@app.route('/api/add', methods=['POST'])
def api_add():
    """Добавление траты из «Быстрых команд». Авторизация по личному токену."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    def field(name):
        return request.form.get(name) or data.get(name) or ''

    token = (request.headers.get('X-Token') or str(field('token'))).strip()
    rec = ApiToken.query.filter_by(token=token).first() if token else None
    if not rec:
        return jsonify(ok=False, error='Неверный токен'), 401

    raw_amount = field('amount')
    try:
        amount = parse_amount(raw_amount)
    except ValueError:
        # Диагностика: показываем, что реально пришло
        return jsonify(
            ok=False,
            error='Некорректная сумма',
            received=str(raw_amount),
            keys=list(data.keys()) + list(request.form.keys()),
            content_type=request.content_type
        ), 400
    if amount <= 0:
        return jsonify(ok=False, error='Сумма должна быть больше нуля', received=str(raw_amount)), 400

    category = str(field('category')).strip()
    if category not in CATEGORIES:
        category = 'Прочее'
    note = str(field('note')).strip()[:255]

    db.session.add(Expense(
        user_id=rec.user_id,
        amount=amount,
        category=category,
        note=note,
        expense_date=date.today()
    ))
    db.session.commit()
    return jsonify(ok=True, amount=amount, category=category)


@app.errorhandler(413)
def too_large(e):
    flash('Фото слишком большое (максимум 10 МБ)', 'error')
    return redirect(url_for('profile'))


@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))

    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'change_password':
            current_password = request.form.get('current_password', '')
            new_password = request.form.get('new_password', '')

            if not check_password_hash(user.password_hash, current_password):
                flash('Текущий пароль неверен', 'error')
                return redirect(url_for('settings'))

            if len(new_password) < 4:
                flash('Новый пароль должен быть не короче 4 символов', 'error')
                return redirect(url_for('settings'))

            user.password_hash = generate_password_hash(new_password)
            db.session.commit()
            flash('Пароль изменён', 'success')
            return redirect(url_for('settings'))

        elif action == 'change_currency':
            new_currency = request.form.get('currency')
            if new_currency in CURRENCIES:
                user.currency = new_currency
                db.session.commit()
                flash('Валюта обновлена', 'success')
            return redirect(url_for('settings'))

    return render_template(
        'settings.html',
        username=user.username,
        currencies=CURRENCIES,
        current_currency=user.currency
    )


@app.route('/settings/delete_account', methods=['POST'])
@login_required
def delete_account():
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))
    Friendship.query.filter(
        db.or_(Friendship.from_user_id == user.id, Friendship.to_user_id == user.id)
    ).delete()
    db.session.delete(user)
    db.session.commit()
    session.clear()
    flash('Аккаунт удалён', 'success')
    return redirect(url_for('login'))


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

