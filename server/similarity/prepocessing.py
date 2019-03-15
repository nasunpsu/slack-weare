import json
import category_encoders as ce
import numpy as np
import pandas as pd
import collections
import re
import math

def prepocess(users):
    """ Fixes dataframe for use in distance function

    Arguments:
        users {Dataframe} -- users to clean
    Returns:
        Dataframe -- Modified users dataframe
    """
    users.channels = users.channels.apply(clean_channels)
    users = add_binarized_channels(users)
    users = drop_student_columns(users)
    users = enumerate_ordinal_columns(users)
    users = fix_nan_columns(users)
    users = clean_kids_column(users)
    return users

def delete_nan_user_columns(user, users):
    """ Removes columns that the given user does not have """
    drop_columns = []
    for col in user.columns:
        val = user.iloc[0][col]
        if val == None:
            drop_columns.append(col)
        if type(val) == float and math.isnan(val):
            drop_columns.append(col)
        if type(val) == str and val == '':
            drop_columns.append(col)
    users.drop(columns=drop_columns, inplace=True)
    return users
    
    
def clean_email(students): 
    """ Fix up email column in students, returning students """
    students = students.rename(columns={'Email': 'email'})
    students.email = students.email.apply(lambda x: x.lower())
    return students

def clean_channels(channel_obj_array):
    """ Given an entry in the channel column, return an array resprenting that column """
    channels = []
    if isinstance(channel_obj_array, str):
        channel_obj_array = json.loads(channel_obj_array) 
    if isinstance(channel_obj_array, float):
        return []
    for channel_obj in channel_obj_array:
        if isinstance(channel_obj, collections.Mapping):
            channels.append(channel_obj['cid'])
            continue
        if isinstance(channel_obj, str):
            channels.append(channel_obj)
            continue
        raise Exception('Invalid type')
    return channels

def add_binarized_channels(users):
    """ Adds columns for each channel to the users dataframe, returning users """
    binarized_channels = users.channels.apply('|'.join).str.get_dummies()
    col_list = list(binarized_channels.columns)
    column_mappings = {name: f'channel_{i}' for i, name in enumerate(col_list)}
    binarized_channels = binarized_channels.rename(index=str, columns=column_mappings)
    binarized_channels = binarized_channels.reset_index() 
    users = pd.merge(users, binarized_channels, left_index=True, right_index=True)
    users = users.drop('channels', 1)
    return users

def drop_student_columns(users):
    """ Removes columns that are too dirty or unnecesary returning new datafram"""
    users['id']=users.email.str.split("@", n=1, expand=True)[0]
    if '_id' in users.columns:
        del users['_id']
    users = users.replace('', np.nan)
    #number of courses, credits are too dirty as many entered text instead of a number
    drop_columns = ["surveyCompletion", "Duration (in seconds)", "NumCourses", "transferCredits", "NumTranCredits",
                    "WhyProfile", "otherChannels", "otherEmploy", "NonUS", "otherIndusry", "KnownThroughProfile",
                    "otherEth", "PPLinPerson", "otherEmail", "ActiveDuty", "OCEnabler", "similar_users", "similar_users_y", "_id", "_id_y", 
                    "real_name", "email", "is_bot", "phone", "name", "last_name"]
    #only drop these columns if they actually exist in the data
    drop_columns = [col for col in drop_columns if col in users.columns]
    users.drop(columns=drop_columns, inplace=True)
    return users

def generate_ordinal_mapping(users, SOCs, CCEs):
    """ Creates an array of mappings from ordinal column values to numerical column values """
    ordinal_cols_mapping = []
    #the following are mappings from textual column values to numberical ones
    important_scale = [
            ('Extremely important', 7),
            ('Pretty important', 6),
            ('Fairly important', 5),
            ('Moderately important', 4),
            ('Somewhat important', 3),
            ('A little important', 2),
            ('Not at all important', 1)
    ]

    interest_scale = [
        ('Extremely interested', 5),
        ('Rather interested', 4),
        ('Somewhat interested', 3),
        ('A bit of interest', 2),
        ('Not at all interested', 1)
    ]

    Agree_scale = [
            ('Strongly agree', 5),
            ('Somewhat agree', 4),
            ('Neither agree nor disagree', 3),
            ('Somewhat disagree', 2),
            ('Strongly disagree', 1)
    ]
    #fill in the mapping array 
    for SOC in SOCs:
        ordinal_cols_mapping.append({
            "col": SOC,
            "mapping": Agree_scale
        })

    for CCE in CCEs:
        ordinal_cols_mapping.append({
            "col": CCE,
            "mapping": Agree_scale
        })

    for PeerInfo in ["PeerAvail", "PeerProfession", "PeerEdu", "PeerDetails"]:
        ordinal_cols_mapping.append({
            "col": PeerInfo,
            "mapping": important_scale
        })

    ordinal_cols_mapping.append({
        "col": "Mconnected",
        "mapping": interest_scale
    })
    return ordinal_cols_mapping

def enumerate_ordinal_columns(users):
    """ Converts ordinal columns to numeric columns """
    #names of all the soc columns
    SOCs = ['SOC'+str(x+1) for x in range(10)]
    #names of all the CCE columns
    CCEs = ['CCE'+str(x+1) for x in range(24)]
    # If users does not have all of the columns don't do any preprocessing
    if any(col_name not in users for col_name in SOCs + CCEs):
       return users
    #mapping from each text column to ordinal values
    #format is array of dicts containing keys 'col' and 'mapping'
    ordinal_cols_mapping = generate_ordinal_mapping(users, SOCs, CCEs)
    encoder = ce.OrdinalEncoder(mapping=ordinal_cols_mapping, return_df=True)
    users = encoder.fit_transform(users)
    #Create new columns by taking the mean of related columns for each row
    users['SOC_f'] = users.apply(lambda row: np.mean([row['SOC9'], row['SOC10']]), axis=1)
    users['SOC_id'] = users.apply(lambda row: np.mean([row['SOC1'], row['SOC2'], row['SOC3'], row['SOC4'], row['SOC5']]), axis=1)
    users['CCE_IR'] = users.apply(lambda row: np.mean([row['CCE13'], row['CCE10'], row['CCE19'], row['CCE9']]), axis=1)
    users['CCE_Coor'] = users.apply(lambda row: np.mean([row['CCE24'], row['CCE20'], row['CCE22'], row['CCE21'], row['CCE17']]), axis=1)
    users['CCE_SS'] = users.apply(lambda row: np.mean([row['CCE1'], row['CCE2'], row['CCE3'], row['CCE4']]), axis=1)
    users.drop(columns=CCEs + SOCs, inplace=True)
    return users

def clean_kids_column(users):
    """ Fixes kids columns """
    if 'kids' not in users.columns:
        return users
    none_i = re.compile(r'none', flags=re.IGNORECASE)
    users['kids'].replace(none_i, 0, inplace=True)
    none_i = re.compile(r'zero', flags=re.IGNORECASE)
    users['kids'].replace(none_i, 0, inplace=True)
    stringany = re.compile(r'[a-zA-Z ()]+', flags=re.IGNORECASE)
    users.kids = users['kids'].replace(stringany, '')
    return users

def drop_nan_columns(users):
    nan_percent_needed = .8
    return users.loc[:, users.isnull().mean() < .8]

def fix_nan_columns(users):
    """ Altes nan columns for use in distance function """
    users = drop_nan_columns(users)
    categorical_cols = ["gender", "InUS", "ethnicity", "Usstate", "marrital", "employment", "industry", "kids"]
    categorical_cols = [c for c in categorical_cols if c in users.columns]
    for col in categorical_cols:
        mode = users[col].mode().iloc[0]
        users[col].fillna(mode, inplace=True)
    # fill with mode, mean, or median
    users_mode, users_mean, users_median = users.mode().iloc[0], users.mean(), users.median()
    users.fillna(users_median, inplace=True)
    return users
